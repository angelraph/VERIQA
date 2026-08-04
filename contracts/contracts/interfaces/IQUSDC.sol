// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice QUSDC token interface. Standard ERC-20 only — the deployed mainnet
/// token (0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5) exposes no `permit`, so the
/// customer payment flow requires two transactions: approve, then payInvoice.
interface IQUSDC is IERC20 {}
