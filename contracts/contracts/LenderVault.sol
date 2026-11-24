// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./WorkingCapitalPool.sol";

/// @title LenderVault
/// @notice Lets anyone lend QUSDC to Veriga shops and earn the advance fees.
///
/// The vault is the only admin of WorkingCapitalPool. Lenders deposit QUSDC and
/// get vault shares (ERC-4626). Their money goes straight into the pool, where
/// shops borrow it, and comes back through automatic repayments from sales.
/// Fees raise the value of every share.
///
/// What nobody can do, including the vault owner:
///  - take lenders' money. The only path that moves funds out of the pool is a
///    lender redeeming their own shares.
///  - grant pool admin rights to anyone else. The vault has no function for it.
///  - change lending terms instantly. New terms wait PARAMS_DELAY before they
///    can be applied, and the pool still enforces its own hard limits.
///
/// The owner can pause new advances at once (a safety brake). Pausing never
/// blocks withdrawals or repayments.
///
/// Share value counts idle money plus principal still out with shops. Unearned
/// fees are not counted until they are paid. Principal of a defaulted advance is
/// written down once anyone calls `trackDefault`, and the write-down shrinks as
/// later sales keep repaying it.
contract LenderVault is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PARAMS_DELAY = 1 days;
    uint256 public constant MAX_TRACKED_DEFAULTS = 64;

    WorkingCapitalPool public immutable pool;

    address[] private _defaulted;
    mapping(address => bool) public isTrackedDefault;

    WorkingCapitalPool.Params public pendingParams;
    uint256 public pendingParamsEta;

    event DefaultTracked(address indexed merchant);
    event DefaultUntracked(address indexed merchant);
    event ParamsProposed(uint256 eta);
    event ParamsApplied();
    event ParamsCancelled();

    error NotDefaulted();
    error AlreadyTracked();
    error StillDefaulted();
    error TooManyDefaults();
    error NothingPending();
    error TooEarly();

    constructor(IERC20 qusdc, WorkingCapitalPool pool_, address owner_)
        ERC20("Veriga Lender Share", "vLEND")
        ERC4626(qusdc)
        Ownable(owner_)
    {
        pool = pool_;
    }

    // Accounting

    /// @dev Shares carry six extra decimals, which makes the first-deposit
    /// donation attack cost far more than it could gain.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /// @notice Idle QUSDC in the pool and vault, plus principal still out with
    /// shops, minus principal of tracked defaults.
    function totalAssets() public view override returns (uint256) {
        IERC20 token = IERC20(asset());
        uint256 idle = token.balanceOf(address(pool)) + token.balanceOf(address(this));
        uint256 principalOut = principalOutstanding();
        uint256 writtenDown = defaultedPrincipal();
        if (writtenDown > principalOut) writtenDown = principalOut;
        return idle + principalOut - writtenDown;
    }

    /// @notice Principal lent and not yet repaid, across all shops. Repayments
    /// pay the fee first, so principal repaid is total repaid minus fees earned.
    function principalOutstanding() public view returns (uint256) {
        uint256 lent = pool.totalLent();
        uint256 principalRepaid = pool.totalRepaid() - pool.totalFeesEarned();
        return lent > principalRepaid ? lent - principalRepaid : 0;
    }

    /// @notice Principal still owed on advances that were marked defaulted.
    function defaultedPrincipal() public view returns (uint256 total) {
        for (uint256 i = 0; i < _defaulted.length; i++) {
            (, , uint256 outstanding, uint256 feeRemaining, , , , bool defaulted) = pool.advances(_defaulted[i]);
            if (defaulted && outstanding > feeRemaining) total += outstanding - feeRemaining;
        }
    }

    /// @notice Money that can leave the pool right now.
    function idleLiquidity() public view returns (uint256) {
        IERC20 token = IERC20(asset());
        return token.balanceOf(address(pool)) + token.balanceOf(address(this));
    }

    function trackedDefaults() external view returns (address[] memory) {
        return _defaulted;
    }

    // Withdrawals are limited by money that is not lent out.

    function maxWithdraw(address owner_) public view override returns (uint256) {
        uint256 mine = super.maxWithdraw(owner_);
        uint256 idle = idleLiquidity();
        return mine < idle ? mine : idle;
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        uint256 mine = super.maxRedeem(owner_);
        uint256 idleShares = convertToShares(idleLiquidity());
        return mine < idleShares ? mine : idleShares;
    }

    // Money flow

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        super._deposit(caller, receiver, assets, shares);
        IERC20 token = IERC20(asset());
        token.forceApprove(address(pool), assets);
        pool.seedLiquidity(assets);
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        uint256 inVault = IERC20(asset()).balanceOf(address(this));
        if (assets > inVault) pool.withdrawLiquidity(assets - inVault);
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    // Defaults (permissionless)

    /// @notice Anyone can record that an advance defaulted, so share value
    /// reflects the loss for everyone at once.
    function trackDefault(address merchant) external {
        if (isTrackedDefault[merchant]) revert AlreadyTracked();
        (, , uint256 outstanding, , , , , bool defaulted) = pool.advances(merchant);
        if (!defaulted || outstanding == 0) revert NotDefaulted();
        if (_defaulted.length >= MAX_TRACKED_DEFAULTS) revert TooManyDefaults();
        isTrackedDefault[merchant] = true;
        _defaulted.push(merchant);
        emit DefaultTracked(merchant);
    }

    /// @notice Anyone can remove a default once it is fully repaid or replaced.
    function untrackDefault(address merchant) external {
        if (!isTrackedDefault[merchant]) revert NotDefaulted();
        (, , uint256 outstanding, , , , , bool defaulted) = pool.advances(merchant);
        if (defaulted && outstanding > 0) revert StillDefaulted();
        isTrackedDefault[merchant] = false;
        uint256 n = _defaulted.length;
        for (uint256 i = 0; i < n; i++) {
            if (_defaulted[i] == merchant) {
                _defaulted[i] = _defaulted[n - 1];
                _defaulted.pop();
                break;
            }
        }
        emit DefaultUntracked(merchant);
    }

    // Owner: a safety brake and slow, visible rule changes

    function pauseLending() external onlyOwner {
        pool.pause();
    }

    function unpauseLending() external onlyOwner {
        pool.unpause();
    }

    function proposeParams(WorkingCapitalPool.Params calldata p) external onlyOwner {
        pendingParams = p;
        pendingParamsEta = block.timestamp + PARAMS_DELAY;
        emit ParamsProposed(pendingParamsEta);
    }

    function cancelParams() external onlyOwner {
        if (pendingParamsEta == 0) revert NothingPending();
        pendingParamsEta = 0;
        emit ParamsCancelled();
    }

    /// @notice Anyone can apply proposed terms once the delay has passed.
    function applyParams() external {
        if (pendingParamsEta == 0) revert NothingPending();
        if (block.timestamp < pendingParamsEta) revert TooEarly();
        pendingParamsEta = 0;
        pool.setParams(pendingParams);
        emit ParamsApplied();
    }
}
