// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @notice Test-only QIE ID: forward registry + reverse resolver in one contract.
contract MockQieNames {
    mapping(string => address) public ownerOf;
    mapping(address => string) public primaryName;

    function setName(string calldata name, address owner, bool setPrimary) external {
        ownerOf[name] = owner;
        if (setPrimary) primaryName[owner] = name;
    }

    function setPrimaryOnly(address owner, string calldata name) external {
        primaryName[owner] = name;
    }

    function resolver(string calldata name) external view returns (bytes32 node, address owner) {
        owner = ownerOf[name];
        node = owner == address(0) ? bytes32(0) : keccak256(bytes(name));
    }

    function resolve(address addr) external view returns (string memory) {
        return primaryName[addr];
    }
}
