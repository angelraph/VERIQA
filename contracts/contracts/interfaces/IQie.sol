// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @notice QIEDEX router (UniswapV2-style). Mainnet: 0x08cd2e72e156D8563B4351eb4065C262A9f553Ef.
/// Only the functions Veriga calls are declared; their selectors were confirmed
/// present in the deployed router bytecode.
interface IQieDexRouter {
    function WETH() external view returns (address);

    function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);

    /// @dev Swaps at most msg.value native QIE for exactly `amountOut` of path[last];
    /// refunds unspent QIE to msg.sender.
    function swapETHForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts);
}

/// @notice Chainlink-compatible aggregator. QIE/USD mainnet feed:
/// 0x3Bc617cF3A4Bb77003e4c556B87b13D556903D17 (8 decimals).
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice QIE ID reverse resolver (address -> primary .qie name).
/// Mainnet: 0x76ec8ed377cC0d36D1B48027ac7892Ec6799171E.
interface IQieReverseResolver {
    function resolve(address addr) external view returns (string memory);
}

/// @notice QIE ID forward registry (full name -> node, owner).
/// Mainnet: 0x1D69d75AD7b77b91C3760F84faC52E651710f62e.
interface IQieNameRegistry {
    function resolver(string calldata name) external view returns (bytes32 node, address owner);
}
