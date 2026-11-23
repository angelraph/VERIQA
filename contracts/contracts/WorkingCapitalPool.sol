// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TrustScoreOracle.sol";
import "./interfaces/IQUSDC.sol";

/// @title WorkingCapitalPool
/// @notice Sales-backed working-capital advances for merchants.
///
/// How a merchant qualifies:
///  - Advance size comes from on-chain *settled* sales only (QUSDC that actually
///    moved through PaymentReceipts). PaymentReceipts reports every settled sale
///    here, so the volume figure needs no trusted operator.
///  - Volume per payer is capped per epoch, and a minimum number of distinct
///    payers is required, so one wallet paying itself in circles cannot inflate
///    the limit.
///  - Cash sales attested by customers never count toward the advance limit.
///    They only feed the off-chain trust score, which must clear a threshold.
///  - A credit ladder bounds the loss from any single identity: the first
///    advance is capped at `baseCreditLimit`, and each fully repaid advance
///    doubles the cap (up to 2^maxLadderSteps). A default resets the ladder.
///
/// How it gets repaid: while an advance is outstanding, PaymentReceipts routes
/// `repayBps` of every incoming settled sale straight into this pool before the
/// merchant receives the rest. Manual repayment is also possible at any time.
/// Past the due date, anyone can mark the advance defaulted, and the default
/// stays on the merchant's record publicly.
contract WorkingCapitalPool is AccessControl, Pausable, ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IQUSDC;

    uint256 public constant EPOCH = 30 days;
    uint256 public constant BPS = 10_000;

    // Hard bounds: even the admin cannot set terms outside these.
    uint256 public constant MAX_FEE_BPS = 1_000; // 10%
    uint256 public constant MIN_REPAY_BPS = 500; // 5%
    uint256 public constant MAX_REPAY_BPS = 5_000; // 50%
    uint256 public constant MAX_ADVANCE_BPS = 5_000; // 50% of epoch volume
    uint256 public constant MIN_TERM = 7 days;
    uint256 public constant MAX_TERM = 180 days;
    uint256 public constant MAX_LADDER_STEPS = 8;

    IQUSDC public immutable qusdc;
    TrustScoreOracle public immutable trustScoreOracle;
    address public paymentReceipts;

    struct Params {
        uint256 minScoreThreshold;
        uint256 advanceBps;
        uint256 feeBps;
        uint256 repayBps;
        uint256 term;
        uint256 baseCreditLimit;
        uint256 maxLadderSteps;
        uint256 minDistinctPayers;
        uint256 perPayerEpochCap;
    }

    Params public params;

    struct Advance {
        uint256 principal;
        uint256 fee;
        uint256 outstanding;
        uint256 feeRemaining;
        uint256 repayBps;
        uint64 startedAt;
        uint64 dueAt;
        bool defaulted;
    }

    mapping(address => Advance) public advances;
    mapping(address => uint256) public ladderStep;
    mapping(address => uint256) public advancesRepaid;
    mapping(address => uint256) public defaultCount;

    mapping(address => mapping(uint256 => uint256)) public settledVolume;
    mapping(address => mapping(uint256 => uint256)) public distinctPayers;
    mapping(address => mapping(uint256 => mapping(address => uint256))) public payerVolume;

    uint256 public totalLent;
    uint256 public totalRepaid;
    uint256 public totalFeesEarned;
    uint256 public totalOutstanding;

    event PaymentReceiptsSet(address paymentReceipts);
    event ParamsUpdated(Params params);
    event LiquiditySeeded(address indexed from, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);
    event SettledSaleRecorded(address indexed merchant, address indexed payer, uint256 epoch, uint256 counted);
    event AdvanceRequested(
        address indexed merchant, uint256 principal, uint256 fee, uint256 repayBps, uint64 dueAt
    );
    event AdvanceRepaid(address indexed merchant, address indexed from, uint256 amount, bool automatic, uint256 remaining);
    event AdvanceClosed(address indexed merchant, bool wasDefaulted, uint256 newLadderStep);
    event AdvanceDefaulted(address indexed merchant, uint256 outstanding, address indexed markedBy);

    error ZeroAmount();
    error NotPaymentReceipts();
    error PaymentReceiptsAlreadySet();
    error ParamOutOfBounds();
    error ScoreTooLow();
    error TooFewDistinctPayers();
    error AmountExceedsCap();
    error AdvanceAlreadyOutstanding();
    error NoOutstandingAdvance();
    error NotYetDue();
    error AlreadyDefaulted();
    error InsufficientIdleLiquidity();

    modifier onlyPaymentReceipts() {
        if (msg.sender != paymentReceipts) revert NotPaymentReceipts();
        _;
    }

    constructor(address admin, address qusdcAddress, address trustScoreOracleAddress, address trustedForwarder)
        ERC2771Context(trustedForwarder)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        qusdc = IQUSDC(qusdcAddress);
        trustScoreOracle = TrustScoreOracle(trustScoreOracleAddress);
        _setParams(
            Params({
                minScoreThreshold: 400,
                advanceBps: 2_000,
                feeBps: 300,
                repayBps: 1_000,
                term: 60 days,
                baseCreditLimit: 100e6,
                maxLadderSteps: 5,
                minDistinctPayers: 5,
                perPayerEpochCap: 200e6
            })
        );
    }

    // Admin

    /// @notice One-time wiring to PaymentReceipts (which itself takes this pool's
    /// address in its constructor, so it cannot be set at deploy time).
    function setPaymentReceipts(address receipts) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (paymentReceipts != address(0)) revert PaymentReceiptsAlreadySet();
        paymentReceipts = receipts;
        emit PaymentReceiptsSet(receipts);
    }

    /// @notice New terms apply only to advances requested afterwards; an open
    /// advance keeps the repayBps and due date it was issued with.
    function setParams(Params calldata p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setParams(p);
    }

    function _setParams(Params memory p) internal {
        if (
            p.feeBps > MAX_FEE_BPS || p.repayBps < MIN_REPAY_BPS || p.repayBps > MAX_REPAY_BPS
                || p.advanceBps == 0 || p.advanceBps > MAX_ADVANCE_BPS || p.term < MIN_TERM || p.term > MAX_TERM
                || p.maxLadderSteps > MAX_LADDER_STEPS || p.baseCreditLimit == 0 || p.perPayerEpochCap == 0
                || p.minScoreThreshold > 1000
        ) revert ParamOutOfBounds();
        params = p;
        emit ParamsUpdated(p);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Liquidity

    function seedLiquidity(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        qusdc.safeTransferFrom(_msgSender(), address(this), amount);
        emit LiquiditySeeded(_msgSender(), amount);
    }

    /// @notice Admin can withdraw idle liquidity only. Money lent to merchants is
    /// not in the contract, and repayments in flight cannot be redirected.
    function withdrawLiquidity(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (amount > qusdc.balanceOf(address(this))) revert InsufficientIdleLiquidity();
        qusdc.safeTransfer(_msgSender(), amount);
        emit LiquidityWithdrawn(_msgSender(), amount);
    }

    // Hooks from PaymentReceipts

    function currentEpoch() public view returns (uint256) {
        return block.timestamp / EPOCH;
    }

    function recordSettledSale(address merchant, address payer, uint256 amount) external onlyPaymentReceipts {
        if (payer == merchant || amount == 0) return;
        uint256 epoch = currentEpoch();
        uint256 already = payerVolume[merchant][epoch][payer];
        uint256 cap = params.perPayerEpochCap;
        if (already == 0) distinctPayers[merchant][epoch] += 1;
        uint256 counted = already >= cap ? 0 : (amount > cap - already ? cap - already : amount);
        payerVolume[merchant][epoch][payer] = already + amount;
        if (counted != 0) settledVolume[merchant][epoch] += counted;
        emit SettledSaleRecorded(merchant, payer, epoch, counted);
    }

    /// @notice Share of a settled sale that must go to the pool right now.
    function repayShareFor(address merchant, uint256 saleAmount) external view returns (uint256) {
        Advance storage a = advances[merchant];
        if (a.outstanding == 0) return 0;
        uint256 share = (saleAmount * a.repayBps) / BPS;
        if (share == 0 && saleAmount > 0) share = 1;
        return share > a.outstanding ? a.outstanding : share;
    }

    /// @dev PaymentReceipts has already transferred `amount` QUSDC to this pool.
    function onAutoRepayment(address merchant, address payer, uint256 amount) external onlyPaymentReceipts {
        _applyRepayment(merchant, payer, amount, true);
    }

    // Merchants

    function eligibleVolume(address merchant) public view returns (uint256 volume, uint256 payers) {
        uint256 epoch = currentEpoch();
        uint256 cur = settledVolume[merchant][epoch];
        uint256 prev = epoch == 0 ? 0 : settledVolume[merchant][epoch - 1];
        if (cur >= prev) {
            return (cur, distinctPayers[merchant][epoch]);
        }
        return (prev, distinctPayers[merchant][epoch - 1]);
    }

    function creditLimit(address merchant) public view returns (uint256) {
        uint256 step = ladderStep[merchant];
        if (step > params.maxLadderSteps) step = params.maxLadderSteps;
        return params.baseCreditLimit << step;
    }

    /// @notice The largest advance the merchant could take right now (0 if not eligible).
    function maxAdvanceFor(address merchant) public view returns (uint256) {
        if (paused() || advances[merchant].outstanding != 0) return 0;
        if (trustScoreOracle.getScore(merchant) < params.minScoreThreshold) return 0;
        (uint256 volume, uint256 payers) = eligibleVolume(merchant);
        if (payers < params.minDistinctPayers) return 0;
        return _cap(merchant, volume);
    }

    function _cap(address merchant, uint256 volume) internal view returns (uint256 cap) {
        cap = (volume * params.advanceBps) / BPS;
        uint256 limit = creditLimit(merchant);
        if (limit < cap) cap = limit;
        uint256 idle = qusdc.balanceOf(address(this));
        if (idle < cap) cap = idle;
    }

    function requestAdvance(uint256 amount) external whenNotPaused nonReentrant {
        address merchant = _msgSender();
        if (amount == 0) revert ZeroAmount();
        if (advances[merchant].outstanding != 0) revert AdvanceAlreadyOutstanding();
        if (trustScoreOracle.getScore(merchant) < params.minScoreThreshold) revert ScoreTooLow();
        (uint256 volume, uint256 payers) = eligibleVolume(merchant);
        if (payers < params.minDistinctPayers) revert TooFewDistinctPayers();
        if (amount > _cap(merchant, volume)) revert AmountExceedsCap();

        uint256 fee = (amount * params.feeBps) / BPS;
        uint64 dueAt = uint64(block.timestamp + params.term);
        advances[merchant] = Advance({
            principal: amount,
            fee: fee,
            outstanding: amount + fee,
            feeRemaining: fee,
            repayBps: params.repayBps,
            startedAt: uint64(block.timestamp),
            dueAt: dueAt,
            defaulted: false
        });
        totalLent += amount;
        totalOutstanding += amount + fee;

        qusdc.safeTransfer(merchant, amount);
        emit AdvanceRequested(merchant, amount, fee, params.repayBps, dueAt);
    }

    /// @notice Anyone may repay on a merchant's behalf.
    function repay(address merchant, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 outstanding = advances[merchant].outstanding;
        if (outstanding == 0) revert NoOutstandingAdvance();
        if (amount > outstanding) amount = outstanding;
        qusdc.safeTransferFrom(_msgSender(), address(this), amount);
        _applyRepayment(merchant, _msgSender(), amount, false);
    }

    /// @notice Permissionless: once an advance is past due and unpaid, anyone can
    /// put the default on the merchant's public record. Auto-repayment from
    /// sales continues afterwards.
    function markDefault(address merchant) external {
        Advance storage a = advances[merchant];
        if (a.outstanding == 0) revert NoOutstandingAdvance();
        if (block.timestamp <= a.dueAt) revert NotYetDue();
        if (a.defaulted) revert AlreadyDefaulted();
        a.defaulted = true;
        defaultCount[merchant] += 1;
        ladderStep[merchant] = 0;
        emit AdvanceDefaulted(merchant, a.outstanding, _msgSender());
    }

    function _applyRepayment(address merchant, address from, uint256 amount, bool automatic) internal {
        Advance storage a = advances[merchant];
        uint256 outstanding = a.outstanding;
        if (amount > outstanding) amount = outstanding;
        // Fee is earned first, principal after.
        uint256 feePaid = amount < a.feeRemaining ? amount : a.feeRemaining;
        a.feeRemaining -= feePaid;
        totalFeesEarned += feePaid;
        a.outstanding = outstanding - amount;
        totalRepaid += amount;
        totalOutstanding -= amount;
        emit AdvanceRepaid(merchant, from, amount, automatic, a.outstanding);

        if (a.outstanding == 0) {
            bool wasDefaulted = a.defaulted;
            if (!wasDefaulted) {
                advancesRepaid[merchant] += 1;
                ladderStep[merchant] += 1;
            }
            emit AdvanceClosed(merchant, wasDefaulted, ladderStep[merchant]);
        }
    }

    // ERC-2771 glue

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
