// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MerchantRegistry.sol";
import "./interfaces/IQUSDC.sol";

/// @title PaymentReceipts
/// @notice Records QUSDC payments to registered merchants and mints a soulbound
/// receipt to the payer. The PaymentRecorded event is the single canonical feed
/// that the off-chain indexer, trust score, and working capital pool all key off.
contract PaymentReceipts is ERC721, ReentrancyGuard {
    using SafeERC20 for IQUSDC;

    MerchantRegistry public immutable merchantRegistry;
    IQUSDC public immutable qusdc;

    uint256 public nextReceiptId;

    struct Receipt {
        address payer;
        address merchant;
        uint256 amount;
        bytes32 invoiceRef;
        uint64 timestamp;
    }

    mapping(uint256 => Receipt) public receipts;

    event PaymentRecorded(
        uint256 indexed receiptId,
        address indexed merchant,
        address indexed payer,
        uint256 amount,
        bytes32 invoiceRef,
        uint64 timestamp
    );

    error MerchantNotRegistered();
    error MerchantInactive();
    error ZeroAmount();
    error ReceiptNotTransferable();

    constructor(address merchantRegistryAddress, address qusdcAddress)
        ERC721("Veriga Payment Receipt", "VERIGA-RECEIPT")
    {
        merchantRegistry = MerchantRegistry(merchantRegistryAddress);
        qusdc = IQUSDC(qusdcAddress);
    }

    function payInvoice(address merchant, uint256 amount, bytes32 invoiceRef) external nonReentrant returns (uint256) {
        if (amount == 0) revert ZeroAmount();

        (, , , uint64 createdAt, , bool active) = merchantRegistry.merchants(merchant);
        if (createdAt == 0) revert MerchantNotRegistered();
        if (!active) revert MerchantInactive();

        qusdc.safeTransferFrom(msg.sender, merchant, amount);

        uint256 receiptId = nextReceiptId++;
        receipts[receiptId] = Receipt({
            payer: msg.sender,
            merchant: merchant,
            amount: amount,
            invoiceRef: invoiceRef,
            timestamp: uint64(block.timestamp)
        });

        _safeMint(msg.sender, receiptId);

        emit PaymentRecorded(receiptId, merchant, msg.sender, amount, invoiceRef, uint64(block.timestamp));
        return receiptId;
    }

    /// @dev Soulbound: block all transfers, allow only minting (from == address(0)).
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert ReceiptNotTransferable();
        return super._update(to, tokenId, auth);
    }
}
