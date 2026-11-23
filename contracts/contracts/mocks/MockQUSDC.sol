// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only stand-in for QUSDC. Never deployed to testnet or mainnet , 
/// used solely by the Hardhat test suite to exercise PaymentReceipts and
/// WorkingCapitalPool against a real ERC-20 implementation.
contract MockQUSDC is ERC20 {
    constructor() ERC20("Mock QUSDC", "mQUSDC") {}

    /// @dev Mirrors the real mainnet QUSDC token (6 decimals), confirmed via
    /// mainnet.qie.digital token explorer, not the ERC20 default of 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
