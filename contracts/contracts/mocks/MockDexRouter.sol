// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./MockQUSDC.sol";

/// @notice Test-only UniswapV2-style router: sells MockQUSDC for native at a
/// fixed rate (wei of native per 1 QUSDC base unit), refunding unspent native.
contract MockDexRouter {
    address public immutable WETH;
    MockQUSDC public immutable qusdc;
    uint256 public weiPerUnit;

    constructor(address weth, MockQUSDC qusdc_, uint256 weiPerUnit_) {
        WETH = weth;
        qusdc = qusdc_;
        weiPerUnit = weiPerUnit_;
    }

    function setRate(uint256 weiPerUnit_) external {
        weiPerUnit = weiPerUnit_;
    }

    function getAmountsIn(uint256 amountOut, address[] calldata) external view returns (uint256[] memory a) {
        a = new uint256[](2);
        a[0] = amountOut * weiPerUnit;
        a[1] = amountOut;
    }

    function swapETHForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline)
        external
        payable
        returns (uint256[] memory amounts)
    {
        require(block.timestamp <= deadline, "EXPIRED");
        require(path[0] == WETH && path[1] == address(qusdc), "PATH");
        uint256 amountIn = amountOut * weiPerUnit;
        require(msg.value >= amountIn, "EXCESSIVE_INPUT_AMOUNT");
        qusdc.mint(to, amountOut);
        if (msg.value > amountIn) {
            (bool ok,) = msg.sender.call{value: msg.value - amountIn}("");
            require(ok, "REFUND");
        }
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}
