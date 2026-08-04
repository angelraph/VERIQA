// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MerchantRegistry
/// @notice Identity anchor for merchants transacting through Veriga.
contract MerchantRegistry is AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    struct Merchant {
        address wallet;
        string profileURI;
        bytes32 passAttestationHash;
        uint64 createdAt;
        bool passVerified;
        bool active;
    }

    mapping(address => Merchant) public merchants;

    event MerchantRegistered(address indexed wallet, string profileURI, uint64 createdAt);
    event MerchantProfileUpdated(address indexed wallet, string profileURI);
    event MerchantPassVerified(address indexed wallet, bytes32 attestationHash);
    event MerchantDeactivated(address indexed wallet);
    event MerchantReactivated(address indexed wallet);

    error AlreadyRegistered();
    error NotRegistered();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ATTESTER_ROLE, admin);
    }

    function isMerchant(address wallet) external view returns (bool) {
        return merchants[wallet].createdAt != 0;
    }

    function registerMerchant(string calldata profileURI) external {
        if (merchants[msg.sender].createdAt != 0) revert AlreadyRegistered();

        merchants[msg.sender] = Merchant({
            wallet: msg.sender,
            profileURI: profileURI,
            passAttestationHash: bytes32(0),
            createdAt: uint64(block.timestamp),
            passVerified: false,
            active: true
        });

        emit MerchantRegistered(msg.sender, profileURI, uint64(block.timestamp));
    }

    function updateProfile(string calldata profileURI) external {
        if (merchants[msg.sender].createdAt == 0) revert NotRegistered();
        merchants[msg.sender].profileURI = profileURI;
        emit MerchantProfileUpdated(msg.sender, profileURI);
    }

    /// @notice Flags a merchant as QIE Pass-verified. Called by a trusted attester
    /// after off-chain KYC confirmation. Never blocks onboarding — verification is
    /// a bonus trust signal, not a gate, since merchants can register and transact
    /// without it.
    function attestQiePassVerified(address wallet, bytes32 attestationHash) external onlyRole(ATTESTER_ROLE) {
        if (merchants[wallet].createdAt == 0) revert NotRegistered();
        merchants[wallet].passVerified = true;
        merchants[wallet].passAttestationHash = attestationHash;
        emit MerchantPassVerified(wallet, attestationHash);
    }

    function deactivate() external {
        if (merchants[msg.sender].createdAt == 0) revert NotRegistered();
        merchants[msg.sender].active = false;
        emit MerchantDeactivated(msg.sender);
    }

    function reactivate() external {
        if (merchants[msg.sender].createdAt == 0) revert NotRegistered();
        merchants[msg.sender].active = true;
        emit MerchantReactivated(msg.sender);
    }
}
