// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./interfaces/IQie.sol";

/// @title MerchantRegistry
/// @notice Identity anchor for merchants transacting through Veriga. Supports
/// gasless use through a trusted ERC-2771 forwarder, so a market seller can
/// register from a phone without holding QIE for gas.
contract MerchantRegistry is AccessControl, ERC2771Context {
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
    /// @notice The merchant's primary .qie name, linked only when the QIE ID
    /// forward registry and reverse resolver agree that the wallet owns it.
    mapping(address => string) public qieNameOf;
    /// @notice Reverse index: keccak256(name) -> merchant wallet.
    mapping(bytes32 => address) public merchantByName;

    IQieNameRegistry public immutable qieNameRegistry;
    IQieReverseResolver public immutable qieReverseResolver;

    event MerchantRegistered(address indexed wallet, string profileURI, uint64 createdAt);
    event MerchantProfileUpdated(address indexed wallet, string profileURI);
    event MerchantPassVerified(address indexed wallet, bytes32 attestationHash);
    event MerchantDeactivated(address indexed wallet);
    event MerchantReactivated(address indexed wallet);
    event MerchantNameLinked(address indexed wallet, string qieName);

    error AlreadyRegistered();
    error NotRegistered();
    error NameNotOwned();

    constructor(address admin, address trustedForwarder, address nameRegistry, address reverseResolver)
        ERC2771Context(trustedForwarder)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ATTESTER_ROLE, admin);
        qieNameRegistry = IQieNameRegistry(nameRegistry);
        qieReverseResolver = IQieReverseResolver(reverseResolver);
    }

    function isMerchant(address wallet) external view returns (bool) {
        return merchants[wallet].createdAt != 0;
    }

    function isActiveMerchant(address wallet) external view returns (bool) {
        Merchant storage m = merchants[wallet];
        return m.createdAt != 0 && m.active;
    }

    function registerMerchant(string calldata profileURI) external {
        address sender = _msgSender();
        if (merchants[sender].createdAt != 0) revert AlreadyRegistered();

        merchants[sender] = Merchant({
            wallet: sender,
            profileURI: profileURI,
            passAttestationHash: bytes32(0),
            createdAt: uint64(block.timestamp),
            passVerified: false,
            active: true
        });

        emit MerchantRegistered(sender, profileURI, uint64(block.timestamp));
    }

    function updateProfile(string calldata profileURI) external {
        address sender = _msgSender();
        if (merchants[sender].createdAt == 0) revert NotRegistered();
        merchants[sender].profileURI = profileURI;
        emit MerchantProfileUpdated(sender, profileURI);
    }

    /// @notice Links the caller's primary .qie name. The name is read from QIE ID
    /// itself (reverse resolver) and confirmed against the forward registry, so a
    /// merchant can never claim a name they do not own.
    function linkQieName() external returns (string memory name) {
        address sender = _msgSender();
        if (merchants[sender].createdAt == 0) revert NotRegistered();

        name = _verifiedNameOf(sender);
        if (bytes(name).length == 0) revert NameNotOwned();

        string memory previous = qieNameOf[sender];
        if (bytes(previous).length != 0) delete merchantByName[keccak256(bytes(previous))];

        qieNameOf[sender] = name;
        merchantByName[keccak256(bytes(name))] = sender;
        emit MerchantNameLinked(sender, name);
    }

    /// @notice Resolves a linked .qie name to its merchant, re-checking QIE ID so
    /// a name that changed hands since linking resolves to nobody.
    function merchantForName(string calldata name) external view returns (address merchant) {
        merchant = merchantByName[keccak256(bytes(name))];
        if (merchant == address(0)) return address(0);
        if (keccak256(bytes(_verifiedNameOf(merchant))) != keccak256(bytes(name))) return address(0);
    }

    function _verifiedNameOf(address wallet) internal view returns (string memory) {
        string memory name;
        try qieReverseResolver.resolve(wallet) returns (string memory n) {
            name = n;
        } catch {
            return "";
        }
        if (bytes(name).length == 0) return "";
        try qieNameRegistry.resolver(name) returns (bytes32, address owner) {
            if (owner != wallet) return "";
        } catch {
            return "";
        }
        return name;
    }

    /// @notice Flags a merchant as QIE Pass-verified after off-chain KYC
    /// confirmation through QIE Pass. Verification is a trust signal, never a gate.
    function attestQiePassVerified(address wallet, bytes32 attestationHash) external onlyRole(ATTESTER_ROLE) {
        if (merchants[wallet].createdAt == 0) revert NotRegistered();
        merchants[wallet].passVerified = true;
        merchants[wallet].passAttestationHash = attestationHash;
        emit MerchantPassVerified(wallet, attestationHash);
    }

    function deactivate() external {
        address sender = _msgSender();
        if (merchants[sender].createdAt == 0) revert NotRegistered();
        merchants[sender].active = false;
        emit MerchantDeactivated(sender);
    }

    function reactivate() external {
        address sender = _msgSender();
        if (merchants[sender].createdAt == 0) revert NotRegistered();
        merchants[sender].active = true;
        emit MerchantReactivated(sender);
    }

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
