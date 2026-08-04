// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TrustScoreOracle.sol";
import "./interfaces/IQUSDC.sol";

/// @title WorkingCapitalPool
/// @notice Small, capped working-capital advance pool underwritten by a merchant's
/// on-chain trust score and trailing payment volume, instead of pure crypto
/// collateral. Deliberately minimal: a proof of the underwriting concept, not a
/// peer-funded lending market. Owner-seeded liquidity, one outstanding advance
/// per merchant at a time, manual repayment.
contract WorkingCapitalPool is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IQUSDC;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IQUSDC public immutable qusdc;
    TrustScoreOracle public immutable trustScoreOracle;

    uint256 public minScoreThreshold = 400;
    uint256 public advanceBps = 2000; // 20% of trailing volume, expressed in basis points

    mapping(address => uint256) public trailingVolume90d;
    mapping(address => uint256) public outstandingAdvance;

    event LiquiditySeeded(address indexed from, uint256 amount);
    event LiquidityWithdrawn(address indexed to, uint256 amount);
    event TrailingVolumeUpdated(address indexed merchant, uint256 volume);
    event AdvanceRequested(address indexed merchant, uint256 amount);
    event AdvanceRepaid(address indexed merchant, uint256 amount);
    event ParamsUpdated(uint256 minScoreThreshold, uint256 advanceBps);

    error ScoreTooLow();
    error AmountExceedsCap();
    error InsufficientLiquidity();
    error AdvanceAlreadyOutstanding();
    error NoOutstandingAdvance();
    error RepayExceedsOutstanding();
    error ZeroAmount();

    constructor(address admin, address qusdcAddress, address trustScoreOracleAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        qusdc = IQUSDC(qusdcAddress);
        trustScoreOracle = TrustScoreOracle(trustScoreOracleAddress);
    }

    function seedLiquidity(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        qusdc.safeTransferFrom(msg.sender, address(this), amount);
        emit LiquiditySeeded(msg.sender, amount);
    }

    function withdrawLiquidity(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        qusdc.safeTransfer(msg.sender, amount);
        emit LiquidityWithdrawn(msg.sender, amount);
    }

    /// @notice Published periodically by the indexer's trusted operator role,
    /// mirroring TrustScoreOracle's off-chain-computed / on-chain-checkpointed pattern.
    function updateTrailingVolume(address merchant, uint256 volume) external onlyRole(OPERATOR_ROLE) {
        trailingVolume90d[merchant] = volume;
        emit TrailingVolumeUpdated(merchant, volume);
    }

    function setParams(uint256 newMinScoreThreshold, uint256 newAdvanceBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minScoreThreshold = newMinScoreThreshold;
        advanceBps = newAdvanceBps;
        emit ParamsUpdated(newMinScoreThreshold, newAdvanceBps);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function maxAdvanceFor(address merchant) public view returns (uint256) {
        uint256 volumeCap = (trailingVolume90d[merchant] * advanceBps) / 10_000;
        uint256 available = qusdc.balanceOf(address(this));
        return volumeCap < available ? volumeCap : available;
    }

    function requestAdvance(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (outstandingAdvance[msg.sender] != 0) revert AdvanceAlreadyOutstanding();
        if (trustScoreOracle.getScore(msg.sender) < minScoreThreshold) revert ScoreTooLow();

        uint256 cap = maxAdvanceFor(msg.sender);
        if (amount > cap) revert AmountExceedsCap();

        outstandingAdvance[msg.sender] = amount;
        qusdc.safeTransfer(msg.sender, amount);

        emit AdvanceRequested(msg.sender, amount);
    }

    function repay(uint256 amount) external nonReentrant {
        uint256 outstanding = outstandingAdvance[msg.sender];
        if (outstanding == 0) revert NoOutstandingAdvance();
        if (amount > outstanding) revert RepayExceedsOutstanding();

        outstandingAdvance[msg.sender] = outstanding - amount;
        qusdc.safeTransferFrom(msg.sender, address(this), amount);

        emit AdvanceRepaid(msg.sender, amount);
    }
}
