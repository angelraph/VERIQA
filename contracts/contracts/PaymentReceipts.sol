// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./MerchantRegistry.sol";
import "./WorkingCapitalPool.sol";
import "./interfaces/IQUSDC.sol";
import "./interfaces/IQie.sol";

/// @title PaymentReceipts
/// @notice Every sale a Veriga merchant makes becomes a soulbound receipt, in one
/// of two evidence tiers:
///
///  - SETTLED: the customer paid on-chain, in QUSDC or in native QIE swapped to
///    QUSDC through QIEDEX in the same transaction. If the merchant has an open
///    working-capital advance, the advance's repayment share is routed to the
///    pool before the merchant receives the rest.
///  - ATTESTED: the customer paid in cash or by bank transfer, and both sides
///    signed the sale: the customer with an EIP-712 signature from a key on
///    their phone, and the merchant by submitting it (directly or gaslessly
///    through the trusted forwarder). Attested sales prove activity but never
///    move money and never raise the advance limit.
///
/// The PaymentRecorded event is the single canonical feed the indexer, the trust
/// score and the traction page are built from.
contract PaymentReceipts is ERC721, ReentrancyGuard, EIP712, ERC2771Context {
    using SafeERC20 for IQUSDC;
    using Strings for uint256;
    using Strings for address;

    enum Tier {
        Settled,
        Attested
    }

    enum Method {
        QUSDC,
        QIE,
        Cash
    }

    /// @notice Largest single cash sale a customer can attest (5,000 QUSDC units).
    uint256 public constant MAX_ATTESTED_AMOUNT = 5_000e6;

    bytes32 public constant SALE_TYPEHASH =
        keccak256("SaleConfirmation(address merchant,address customer,uint256 amount,bytes32 saleRef,uint256 deadline)");

    /// @notice Signed by the merchant's phone and embedded in the sale QR code.
    /// Any one customer can complete it, exactly once (saleRef is single-use).
    bytes32 public constant SALE_OFFER_TYPEHASH =
        keccak256("SaleOffer(address merchant,uint256 amount,bytes32 saleRef,uint256 deadline)");

    MerchantRegistry public immutable merchantRegistry;
    IQUSDC public immutable qusdc;
    WorkingCapitalPool public immutable pool;
    IQieDexRouter public immutable dexRouter;
    IAggregatorV3 public immutable qieUsdFeed;
    uint256 public immutable maxOracleAge;
    uint256 public immutable maxSwapPremiumBps;

    uint256 public nextReceiptId;
    uint256 public totalSettledVolume;
    uint256 public totalAttestedVolume;

    struct Receipt {
        address payer;
        address merchant;
        uint256 amount;
        bytes32 invoiceRef;
        uint64 timestamp;
        Tier tier;
        Method method;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(address => mapping(bytes32 => bool)) public saleRefUsed;

    event PaymentRecorded(
        uint256 indexed receiptId,
        address indexed merchant,
        address indexed payer,
        uint256 amount,
        bytes32 invoiceRef,
        uint64 timestamp,
        Tier tier,
        Method method,
        uint256 repaidToPool
    );

    error MerchantNotRegistered();
    error MerchantInactive();
    error ZeroAmount();
    error ReceiptNotTransferable();
    error SelfSale();
    error AmountTooLarge();
    error SaleRefUsed();
    error SignatureExpired();
    error InvalidCustomerSignature();
    error InvalidMerchantSignature();
    error OracleStale();
    error OracleInvalid();
    error SwapAboveOracle(uint256 spent, uint256 maxAllowed);
    error SwapShortfall();
    error RefundFailed();
    error UnexpectedNative();

    constructor(
        address merchantRegistryAddress,
        address qusdcAddress,
        address poolAddress,
        address dexRouterAddress,
        address qieUsdFeedAddress,
        address trustedForwarder,
        uint256 maxOracleAge_,
        uint256 maxSwapPremiumBps_
    ) ERC721("Veriga Receipt", "VRCPT") EIP712("Veriga", "1") ERC2771Context(trustedForwarder) {
        merchantRegistry = MerchantRegistry(merchantRegistryAddress);
        qusdc = IQUSDC(qusdcAddress);
        pool = WorkingCapitalPool(poolAddress);
        dexRouter = IQieDexRouter(dexRouterAddress);
        qieUsdFeed = IAggregatorV3(qieUsdFeedAddress);
        maxOracleAge = maxOracleAge_;
        maxSwapPremiumBps = maxSwapPremiumBps_;
    }

    // Settled

    /// @notice Pay in QUSDC (needs a prior approve; QUSDC has no permit).
    function payInvoice(address merchant, uint256 amount, bytes32 invoiceRef)
        external
        nonReentrant
        returns (uint256)
    {
        if (amount == 0) revert ZeroAmount();
        _requireActiveMerchant(merchant);
        address payer = _msgSender();
        qusdc.safeTransferFrom(payer, address(this), amount);
        return _settle(merchant, payer, amount, invoiceRef, Method.QUSDC);
    }

    /// @notice Pay in native QIE: swaps to exactly `amount` QUSDC through QIEDEX in
    /// this same transaction. The QIE actually spent must stay within
    /// `maxSwapPremiumBps` of the QIE/USD oracle price, and unspent QIE is refunded.
    function payWithQIE(address merchant, uint256 amount, bytes32 invoiceRef, uint256 deadline)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        if (amount == 0 || msg.value == 0) revert ZeroAmount();
        _requireActiveMerchant(merchant);
        address payer = _msgSender();

        address[] memory path = new address[](2);
        path[0] = dexRouter.WETH();
        path[1] = address(qusdc);

        uint256 qusdcBefore = qusdc.balanceOf(address(this));
        uint256 nativeBefore = address(this).balance - msg.value;
        uint256[] memory amounts =
            dexRouter.swapETHForExactTokens{value: msg.value}(amount, path, address(this), deadline);
        if (qusdc.balanceOf(address(this)) - qusdcBefore < amount) revert SwapShortfall();

        uint256 spent = amounts[0];
        uint256 maxAllowed = maxQieFor(amount);
        if (spent > maxAllowed) revert SwapAboveOracle(spent, maxAllowed);

        uint256 refund = address(this).balance - nativeBefore;
        if (refund > 0) {
            (bool ok,) = payer.call{value: refund}("");
            if (!ok) revert RefundFailed();
        }

        return _settle(merchant, payer, amount, invoiceRef, Method.QIE);
    }

    /// @notice Most native QIE the contract will accept spending for `qusdcAmount`,
    /// from the QIE/USD oracle plus the allowed premium (covers DEX fee + slippage).
    function maxQieFor(uint256 qusdcAmount) public view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = qieUsdFeed.latestRoundData();
        if (answer <= 0) revert OracleInvalid();
        if (block.timestamp > updatedAt + maxOracleAge) revert OracleStale();
        uint8 feedDecimals = qieUsdFeed.decimals();
        // qusdc (6 dp) -> QIE wei (18 dp): amount * 10^12 * 10^feedDecimals / price
        uint256 fair = (qusdcAmount * 1e12 * (10 ** feedDecimals)) / uint256(answer);
        return (fair * (10_000 + maxSwapPremiumBps)) / 10_000;
    }

    function _settle(address merchant, address payer, uint256 amount, bytes32 invoiceRef, Method method)
        internal
        returns (uint256 receiptId)
    {
        uint256 toPool = pool.repayShareFor(merchant, amount);
        if (toPool > 0) {
            qusdc.safeTransfer(address(pool), toPool);
            pool.onAutoRepayment(merchant, payer, toPool);
        }
        qusdc.safeTransfer(merchant, amount - toPool);
        pool.recordSettledSale(merchant, payer, amount);

        totalSettledVolume += amount;
        receiptId = _mintReceipt(payer, merchant, amount, invoiceRef, Tier.Settled, method, toPool);
    }

    // Attested

    /// @notice Records a cash / bank-transfer sale. The merchant is the caller
    /// (directly or via the forwarder); the customer's consent is the EIP-712
    /// signature. No money moves. The receipt is minted to the customer.
    function recordAttestedSale(
        address customer,
        uint256 amount,
        bytes32 saleRef,
        uint256 deadline,
        bytes calldata customerSignature
    ) external nonReentrant returns (uint256) {
        address merchant = _msgSender();
        _checkAttested(merchant, customer, amount, saleRef, deadline, customerSignature);
        return _recordAttested(merchant, customer, amount, saleRef);
    }

    /// @notice One-tap path: the merchant's phone signs a SaleOffer into the QR
    /// code (works offline), the customer scans and signs a SaleConfirmation, and
    /// anyone (Veriga's relayer) submits both. Neither side needs gas or a wallet
    /// app, and the merchant doesn't need to be online when the customer confirms.
    function recordConfirmedSale(
        address merchant,
        address customer,
        uint256 amount,
        bytes32 saleRef,
        uint256 deadline,
        bytes calldata merchantSignature,
        bytes calldata customerSignature
    ) external nonReentrant returns (uint256) {
        bytes32 offer = offerDigest(merchant, amount, saleRef, deadline);
        if (!SignatureChecker.isValidSignatureNow(merchant, offer, merchantSignature)) {
            revert InvalidMerchantSignature();
        }
        _checkAttested(merchant, customer, amount, saleRef, deadline, customerSignature);
        return _recordAttested(merchant, customer, amount, saleRef);
    }

    function _checkAttested(
        address merchant,
        address customer,
        uint256 amount,
        bytes32 saleRef,
        uint256 deadline,
        bytes calldata customerSignature
    ) internal view {
        _requireActiveMerchant(merchant);
        if (amount == 0) revert ZeroAmount();
        if (amount > MAX_ATTESTED_AMOUNT) revert AmountTooLarge();
        if (customer == merchant || customer == address(0)) revert SelfSale();
        if (block.timestamp > deadline) revert SignatureExpired();
        if (saleRefUsed[merchant][saleRef]) revert SaleRefUsed();
        bytes32 digest = saleDigest(merchant, customer, amount, saleRef, deadline);
        if (!SignatureChecker.isValidSignatureNow(customer, digest, customerSignature)) {
            revert InvalidCustomerSignature();
        }
    }

    function _recordAttested(address merchant, address customer, uint256 amount, bytes32 saleRef)
        internal
        returns (uint256)
    {
        saleRefUsed[merchant][saleRef] = true;
        totalAttestedVolume += amount;
        return _mintReceipt(customer, merchant, amount, saleRef, Tier.Attested, Method.Cash, 0);
    }

    function offerDigest(address merchant, uint256 amount, bytes32 saleRef, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(SALE_OFFER_TYPEHASH, merchant, amount, saleRef, deadline)));
    }

    function saleDigest(address merchant, address customer, uint256 amount, bytes32 saleRef, uint256 deadline)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(SALE_TYPEHASH, merchant, customer, amount, saleRef, deadline)));
    }

    // Internals

    function _requireActiveMerchant(address merchant) internal view {
        (,,, uint64 createdAt,, bool active) = merchantRegistry.merchants(merchant);
        if (createdAt == 0) revert MerchantNotRegistered();
        if (!active) revert MerchantInactive();
    }

    function _mintReceipt(
        address to,
        address merchant,
        uint256 amount,
        bytes32 ref,
        Tier tier,
        Method method,
        uint256 repaidToPool
    ) internal returns (uint256 receiptId) {
        receiptId = nextReceiptId++;
        receipts[receiptId] = Receipt({
            payer: to,
            merchant: merchant,
            amount: amount,
            invoiceRef: ref,
            timestamp: uint64(block.timestamp),
            tier: tier,
            method: method
        });
        _mint(to, receiptId);
        emit PaymentRecorded(receiptId, merchant, to, amount, ref, uint64(block.timestamp), tier, method, repaidToPool);
    }

    /// @dev Only the DEX router may send native QIE here (swap refunds).
    receive() external payable {
        if (msg.sender != address(dexRouter)) revert UnexpectedNative();
    }

    /// @dev Soulbound: minting only.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert ReceiptNotTransferable();
        return super._update(to, tokenId, auth);
    }

    // On-chain art

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Receipt memory r = receipts[tokenId];
        string memory amountStr = _formatAmount(r.amount);
        string memory tierStr = r.tier == Tier.Settled ? "Settled" : "Attested";
        string memory methodStr = r.method == Method.QUSDC ? "QUSDC" : (r.method == Method.QIE ? "QIE" : "Cash");
        string memory merchantName = merchantRegistry.qieNameOf(r.merchant);
        string memory merchantLabel = bytes(merchantName).length != 0 ? merchantName : r.merchant.toHexString();

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 220"><rect width="360" height="220" rx="18" fill="#0b1220"/>',
            '<text x="24" y="44" font-family="monospace" font-size="18" fill="#34d399">VERIGA RECEIPT #',
            tokenId.toString(),
            '</text><text x="24" y="96" font-family="monospace" font-size="34" fill="#f8fafc">$',
            amountStr,
            '</text><text x="24" y="132" font-family="monospace" font-size="13" fill="#94a3b8">',
            tierStr,
            " / ",
            methodStr,
            '</text><text x="24" y="186" font-family="monospace" font-size="11" fill="#64748b">',
            _truncate(merchantLabel),
            "</text></svg>"
        );

        string memory json = string.concat(
            '{"name":"Veriga Receipt #',
            tokenId.toString(),
            '","description":"Soulbound proof of a sale recorded on QIE.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Tier","value":"',
            tierStr,
            '"},{"trait_type":"Method","value":"',
            methodStr,
            '"},{"trait_type":"Amount (USD)","value":"',
            amountStr,
            '"},{"trait_type":"Merchant","value":"',
            merchantLabel,
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 cents = (amount % 1e6) / 1e4;
        return string.concat(whole.toString(), ".", cents < 10 ? "0" : "", cents.toString());
    }

    function _truncate(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= 42) return s;
        bytes memory out = new bytes(42);
        for (uint256 i = 0; i < 42; i++) out[i] = b[i];
        return string(out);
    }

    // ERC-2771 glue

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
