// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @title VerigaForwarder
/// @notice Trusted ERC-2771 forwarder. A merchant or customer signs a request
/// with a key on their phone, and Veriga's relayer submits it and pays the gas.
/// The target contract sees the signer as the sender, so a relayer can never act
/// on anyone's behalf without their signature, and signed requests carry nonces
/// and deadlines.
contract VerigaForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("VerigaForwarder") {}
}
