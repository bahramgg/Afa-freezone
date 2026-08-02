// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * AFA — on-chain settlement of a payment into its three shares.
 *
 * A buyer pays into an address that belongs to one invoice and nothing else.
 * That address is not a wallet: it is where a tiny contract will be deployed,
 * and its address is derived from the split that was agreed when the invoice
 * was approved. Releasing it pays the gateway, the free zone organization and
 * the bank in one transaction, in the proportions the address itself commits
 * to.
 *
 * Nobody holds a key to a deposit address, and nobody — the factory owner
 * included — can change where an already-quoted payment will go. Changing the
 * fee or a destination wallet produces different addresses for future
 * invoices; it cannot touch money already sitting at an old one.
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
}

/**
 * The terms a deposit address commits to.
 *
 * Everything that decides who gets what is in here, and the address is the
 * hash of it — so the split can be checked by anyone, before or after the
 * money arrives, without trusting this system at all.
 */
struct Terms {
    /// The invoice this address belongs to, e.g. "INV-1042".
    string invoiceRef;
    /// Gateway fee, in basis points of the amount received.
    uint16 feeBps;
    /// The organization's cut, in basis points of the fee.
    uint16 freezoneBps;
    /// Floor and ceiling on the fee, in token units. Zero ceiling means none.
    uint256 feeMin;
    uint256 feeMax;
    address token;
    address gatewayWallet;
    address freezoneWallet;
    /**
     * Whoever the payment is ultimately for, once the fees are off it.
     *
     * Exporting, that is the bank, which then pays the Iranian merchant in
     * rial. Importing, it is the foreign seller's own wallet, and the bank is
     * the one paying in. The contract does not need to know which: it pays
     * whoever the terms name, and the terms are fixed in the address.
     */
    address beneficiary;
}

/**
 * Deployed once per invoice, at an address derived from its terms.
 *
 * It holds nothing and decides nothing: the terms arrive as constructor
 * arguments, which is what binds them to the address, and every release pays
 * out whatever balance is present under exactly those terms.
 */
contract AfaDeposit {
    Terms private terms;

    event Released(
        string invoiceRef,
        uint256 total,
        uint256 gatewayAmount,
        uint256 freezoneAmount,
        uint256 beneficiaryAmount
    );

    constructor(Terms memory t) {
        terms = t;
        // A payment that arrived before the deploy is settled immediately, so
        // the usual case costs one transaction rather than two.
        if (IERC20(t.token).balanceOf(address(this)) > 0) _release();
    }

    /**
     * Pays out the current balance.
     *
     * Callable by anyone, because there is nothing to gain: the destinations
     * are fixed by this contract's own address. That also means a late payment
     * or a top-up can always be settled, by us, by the bank, or by the buyer
     * themselves if everyone else has gone home.
     */
    function release() external {
        _release();
    }

    function _release() private {
        Terms memory t = terms;
        uint256 total = IERC20(t.token).balanceOf(address(this));
        require(total > 0, "nothing to release");

        uint256 fee = (total * t.feeBps) / 10_000;
        if (fee < t.feeMin) fee = t.feeMin;
        if (t.feeMax > 0 && fee > t.feeMax) fee = t.feeMax;
        // A fee can never exceed the payment it is taken from.
        if (fee > total) fee = total;

        uint256 freezoneAmount = (fee * t.freezoneBps) / 10_000;
        // Subtracting rather than computing keeps the two shares adding back to
        // the fee exactly, and the remainder to the total exactly. No dust is
        // stranded here, ever.
        uint256 gatewayAmount = fee - freezoneAmount;
        uint256 beneficiaryAmount = total - fee;

        if (gatewayAmount > 0) _send(t.token, t.gatewayWallet, gatewayAmount);
        if (freezoneAmount > 0) _send(t.token, t.freezoneWallet, freezoneAmount);
        if (beneficiaryAmount > 0) _send(t.token, t.beneficiary, beneficiaryAmount);

        emit Released(t.invoiceRef, total, gatewayAmount, freezoneAmount, beneficiaryAmount);
    }

    /** BEP-20 tokens vary in whether they return a bool; both are accepted. */
    function _send(address token, address to, uint256 value) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, value)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }

    /** The terms this address is bound to, for anyone who wants to check. */
    function getTerms() external view returns (Terms memory) {
        return terms;
    }
}

/**
 * Derives deposit addresses and releases them.
 *
 * The factory never holds funds and has no way to move them. It stores the
 * current terms only so that new invoices are quoted consistently; an address
 * already handed to a buyer is bound to the terms it was derived from.
 */
contract AfaGatewayFactory {
    address public owner;

    address public token;
    address public gatewayWallet;
    address public freezoneWallet;
    address public beneficiary;
    uint16 public feeBps;
    uint16 public freezoneBps;
    uint256 public feeMin;
    uint256 public feeMax;

    event TermsChanged(
        uint16 feeBps,
        uint16 freezoneBps,
        uint256 feeMin,
        uint256 feeMax,
        address gatewayWallet,
        address freezoneWallet,
        address beneficiary
    );
    event Deployed(string invoiceRef, address deposit);
    event OwnerChanged(address previous, address next);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(
        address _token,
        address _gatewayWallet,
        address _freezoneWallet,
        address _beneficiary,
        uint16 _feeBps,
        uint16 _freezoneBps,
        uint256 _feeMin,
        uint256 _feeMax
    ) {
        owner = msg.sender;
        token = _token;
        _setTerms(_gatewayWallet, _freezoneWallet, _beneficiary, _feeBps, _freezoneBps, _feeMin, _feeMax);
    }

    function setTerms(
        address _gatewayWallet,
        address _freezoneWallet,
        address _beneficiary,
        uint16 _feeBps,
        uint16 _freezoneBps,
        uint256 _feeMin,
        uint256 _feeMax
    ) external onlyOwner {
        _setTerms(_gatewayWallet, _freezoneWallet, _beneficiary, _feeBps, _freezoneBps, _feeMin, _feeMax);
    }

    function _setTerms(
        address _gatewayWallet,
        address _freezoneWallet,
        address _beneficiary,
        uint16 _feeBps,
        uint16 _freezoneBps,
        uint256 _feeMin,
        uint256 _feeMax
    ) private {
        require(_gatewayWallet != address(0), "gateway wallet required");
        require(_freezoneWallet != address(0), "freezone wallet required");
        require(_beneficiary != address(0), "beneficiary required");
        require(_feeBps <= 10_000, "fee out of range");
        require(_freezoneBps <= 10_000, "share out of range");
        require(_feeMax == 0 || _feeMax >= _feeMin, "ceiling below floor");

        gatewayWallet = _gatewayWallet;
        freezoneWallet = _freezoneWallet;
        beneficiary = _beneficiary;
        feeBps = _feeBps;
        freezoneBps = _freezoneBps;
        feeMin = _feeMin;
        feeMax = _feeMax;

        emit TermsChanged(_feeBps, _freezoneBps, _feeMin, _feeMax, _gatewayWallet, _freezoneWallet, _beneficiary);
    }

    function transferOwnership(address next) external onlyOwner {
        require(next != address(0), "owner required");
        emit OwnerChanged(owner, next);
        owner = next;
    }

    /** The terms an invoice quoted today would be bound to. */
    function currentTerms(string calldata invoiceRef) public view returns (Terms memory) {
        return Terms({
            invoiceRef: invoiceRef,
            feeBps: feeBps,
            freezoneBps: freezoneBps,
            feeMin: feeMin,
            feeMax: feeMax,
            token: token,
            gatewayWallet: gatewayWallet,
            freezoneWallet: freezoneWallet,
            beneficiary: beneficiary
        });
    }

    function _initCode(Terms memory t) private pure returns (bytes memory) {
        return abi.encodePacked(type(AfaDeposit).creationCode, abi.encode(t));
    }

    /**
     * Where a buyer should pay, for these exact terms.
     *
     * Pure derivation — nothing is deployed and no state changes, so the
     * address can be quoted the moment an invoice is approved and long before
     * anyone spends gas on it.
     */
    function depositAddress(Terms memory t) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), bytes32(0), keccak256(_initCode(t)))
        );
        return address(uint160(uint256(hash)));
    }

    /** The address for an invoice under today's terms. */
    function depositAddressFor(string calldata invoiceRef) external view returns (address) {
        return depositAddress(currentTerms(invoiceRef));
    }

    /**
     * Settles whatever is sitting at the address these terms derive.
     *
     * The terms are passed in rather than read from storage, so a payment is
     * always released on the terms it was quoted under — changing the fee
     * afterwards cannot reach back and take more from a buyer who has already
     * paid.
     */
    function release(Terms calldata t) external returns (address deposit) {
        deposit = depositAddress(t);

        if (deposit.code.length == 0) {
            AfaDeposit created = new AfaDeposit{salt: bytes32(0)}(t);
            require(address(created) == deposit, "address mismatch");
            emit Deployed(t.invoiceRef, deposit);
        } else {
            AfaDeposit(deposit).release();
        }
    }
}
