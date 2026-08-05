export type Currency = "USDT" | "BNB";

export type UserType = "IRANIAN" | "FOREIGN";

export type InvoiceStatus =
  | "PENDING"
  | "APPROVED"
  /** Import only: the bank has priced it and named the rial account. */
  | "BANK_RATE_LOCKED"
  /** Import only: the importer's rial has reached the bank. */
  | "RIAL_RECEIVED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "EXPIRED"
  | "REJECTED"
  /** Import only: called off, and the importer's rial has not gone back yet. */
  | "CANCELLING"
  | "CANCELLED";

export type TradeDirection = "EXPORT" | "IMPORT";

export type InvoiceDirection = "RECEIVE" | "SEND";

export type Invoice = {
  id: string;
  trxId: string;
  direction: InvoiceDirection;
  amount: number;
  currency: Currency;
  description: string;
  senderName: string;
  goodsTitle: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  paymentAddress: string;
  /** What actually arrived, which may be short of or beyond the amount. */
  receivedAmount?: number;
  /** Seen on chain but not yet irreversible. Nothing is posted from it. */
  pendingAmount?: number;
  walletAddress?: string;
  txHash?: string;
  counterpartyUid?: string;
  counterpartyName?: string;
  userUid?: string;
  userName?: string;
  expiresAt?: string;
  netAmount?: number;
  fee?: number;
  tradeDirection?: TradeDirection;
  /** Import only: the seller's wallet, where the principal is paid. */
  beneficiaryWallet?: string;
  depositAccount?: string;
  exchangeRate?: number;
  rialAmount?: number;
  rialReceiptNo?: string;
  rialDepositAt?: string;
  bankSpreadRial?: number;
  rejectReason?: string;
  /**
   * Calling an import off. A request that is set while `cancelledAt` is not is
   * the state worth showing differently: somebody has asked, nobody has decided.
   */
  cancelRequestedAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
  rialReturnReceiptNo?: string;
  rialReturnedAt?: string;
};


export type TradeDocumentKind =
  | "PROFORMA"
  | "ORDER_REGISTRATION"
  | "CUSTOMS_DECLARATION"
  | "CONTRACT";

export type TradeDocument = {
  id: string;
  kind: TradeDocumentKind;
  number: string;
  issuedAt?: string;
  issuer?: string;
};


export type SettlementStatus =
  | "AWAITING_ADMIN"
  | "AWAITING_BANK"
  | "BANK_RATE_LOCKED"
  | "CRYPTO_RECEIVED"
  | "CRYPTO_CONFIRMED"
  | "SETTLED"
  | "REJECTED";

export type Settlement = {
  id: string;
  trxId: string;
  userUid?: string;
  userName?: string;
  goodsTitle: string;
  description: string;
  txHash: string;
  amount: number;
  currency: Currency;
  /** Absent on a payout raised from an invoice — the bank already holds it. */
  walletAddress?: string;
  payoutAccount?: string;
  /** Set when this payout was raised from a paid invoice. */
  sourceInvoiceId?: string;
  feeAmount?: number;
  netAmount?: number;
  /** The bank's exchange margin on this settlement, in rial. */
  bankSpreadRial?: number;
  status: SettlementStatus;
  createdAt: string;
  updatedAt: string;
  bankResponseAt?: string;
  bankResponseNote?: string;
  settledAt?: string;
  exchangeRate?: number;
  rateLocked?: boolean;
  rialAmount?: number;
  bankWalletAddress?: string;
  userPayoutTxHash?: string;
  rialReceiptNo?: string;
  rialDepositAt?: string;
  rejectedBy?: "ADMIN" | "BANK";
  rejectReason?: string;
};

export type RefundStatus = "REQUESTED" | "APPROVED" | "SENT" | "REJECTED";

export type Refund = {
  id: string;
  invoiceRef: string;
  merchantUid?: string;
  merchantName?: string;
  amount: number;
  currency: Currency;
  /** Read off the payment that funded the invoice, never typed by anyone. */
  toAddress: string;
  status: RefundStatus;
  reason: string;
  rejectReason?: string;
  txHash?: string;
  requestedBy?: string;
  sentAt?: string;
  createdAt: string;
};

export type Wallet = {
  /** Server-side row id; the address alone is not unique across users. */
  id: string;
  address: string;
  label: string;
  /** What the configured chain is called. Display only. */
  network: string;
  /** True only once a signature recovered to this address. */
  verified: boolean;
  /** Null until ownership has been proven. */
  verifiedAt: string | null;
  createdAt?: string;
};

export type Role = "IRANIAN" | "FOREIGN" | "ADMIN" | "BANK";

export type User = {
  id?: string;
  uid: string;
  role?: Role;
  type?: UserType;
  fullName: string;
  nationalId: string;
  phone: string;
  address: string;
  freezoneId?: string;
  email?: string;
  joinedAt: string;
  kyc: "APPROVED" | "PENDING" | "REJECTED";
  kycRejectReason?: string;
  avatarColor: string;
  disabled?: boolean;
};

export type ForeignUser = {
  uid: string;
  fullName: string;
  passportNo: string;
  country: string;
  email: string;
  phone: string;
  address: string;
  joinedAt: string;
  kyc: "APPROVED" | "PENDING" | "REJECTED";
  avatarColor: string;
};

export type AdminUserRecord = {
  uid: string;
  fullName: string;
  type: UserType;
  nationalId?: string;
  passportNo?: string;
  country?: string;
  phone?: string;
  email?: string;
  kyc: "APPROVED" | "PENDING" | "REJECTED";
  kycRejectReason?: string;
  invoiceCount: number;
  volume: number;
  joinedAt: string;
  freezoneId?: string;
  address?: string;
};

export type BankWalletKind = "SEND" | "RECEIVE" | "SHARED";

export type BankWallet = {
  id: string;
  address: string;
  label: string;
  /** What the configured chain is called. Display only. */
  network: string;
  kind: BankWalletKind;
  usdtBalance: number;
  bnbBalance: number;
  active: boolean;
  createdAt: string;
};

export type NotificationKind =
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "INVOICE_APPROVED"
  | "INVOICE_REJECTED"
  | "PAYMENT_RECEIVED"
  | "INVOICE_EXPIRED"
  | "SETTLEMENT_APPROVED"
  | "SETTLEMENT_SETTLED"
  | "SETTLEMENT_REJECTED"
  | "FOREIGN_RECEIVE_REQUEST"
  | "FOREIGN_CRYPTO_RECEIVED"
  | "SETTLEMENT_FROM_INVOICE"
  | "PAYMENT_PARTIAL"
  | "INVOICE_ADDRESSED"
  | "INVOICE_RATE_LOCKED"
  | "INVOICE_RIAL_RECEIVED"
  | "INVOICE_CANCEL_REQUESTED"
  | "INVOICE_CANCELLED"
  | "INVOICE_RIAL_RETURNED"
  | "REFUND_REQUESTED"
  | "REFUND_UPDATED";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
};

export type Transaction = {
  id: string;
  trxId?: string;
  /** Present once the deposit is matched to a record. */
  matched?: boolean;
  blockNumber?: string;
  invoiceId?: string;
  direction: InvoiceDirection;
  amount: number;
  currency: Currency;
  counterpartyUid?: string;
  counterpartyName?: string;
  txHash: string;
  status: "CONFIRMED" | "CONFIRMING" | "SEEN" | "PENDING" | "FAILED" | "UNMATCHED";
  createdAt: string;
  fromAddress: string;
  toAddress: string;
  confirmations: number;
  fee: number;
  /**
   * An operator has taken this unmatched deposit on. Only ever set on one that
   * matched no invoice — a matched deposit belongs to the flow that owns it.
   */
  flaggedAt?: string;
  flaggedBy?: string;
  flaggedByUid?: string;
  flagNote?: string;
};

export type Settings = {
  feeBasePercent: number;
  feeMin: number;
  feeMax: number;
  invoiceValidityMinutes: number;
  invoiceMinAmount: number;
  invoiceMaxAmount: number;
  usdtRate: number;
  bnbRate: number;
  dailySendLimit: number;
  dailySettlementLimit: number;
  minTxAmount: number;
  rateTolerancePercent: number;
  freezoneSharePercent: number;
};
