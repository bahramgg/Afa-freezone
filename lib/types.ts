export type Currency = "USDT" | "BNB";

export type UserType = "IRANIAN" | "FOREIGN";

export type InvoiceStatus =
  | "PENDING"
  | "APPROVED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "EXPIRED"
  | "REJECTED";

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
  walletAddress?: string;
  txHash?: string;
  counterpartyUid?: string;
  counterpartyName?: string;
  userUid?: string;
  userName?: string;
  expiresAt?: string;
  netAmount?: number;
  fee?: number;
  rejectReason?: string;
};

export type SendStatus =
  | "AWAITING_COUNTERPARTY"
  | "AWAITING_ADMIN"
  | "AWAITING_BANK_REVIEW"
  | "BANK_RATE_LOCKED"
  | "RIAL_RECEIVED"
  | "CRYPTO_SENT"
  | "PAYMENT_PENDING"
  | "PAID"
  | "REJECTED";

export type SendRequest = {
  id: string;
  trxId: string;
  userUid?: string;
  userName?: string;
  counterpartyUid: string;
  counterpartyName?: string;
  amount: number;
  currency: Currency;
  description?: string;
  status: SendStatus;
  createdAt: string;
  updatedAt: string;
  paymentAddress?: string;
  txHash?: string;
  exchangeRate?: number;
  rateLocked?: boolean;
  rialAmount?: number;
  bankAccount?: string;
  rialReceiptNo?: string;
  rialDepositAt?: string;
  bankWalletAddress?: string;
  recipientWalletAddress?: string;
  txHashFromBank?: string;
  rejectedBy?: "ADMIN" | "BANK";
  rejectReason?: string;
};

export type SettlementStatus =
  | "AWAITING_ADMIN"
  | "AWAITING_BANK"
  | "BANK_RATE_LOCKED"
  | "CRYPTO_RECEIVED"
  | "CRYPTO_CONFIRMED"
  | "BANK_APPROVED"
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
  walletAddress: string;
  bankAccount: string;
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

export type Wallet = {
  address: string;
  label: string;
  network: "BSC";
  verified: boolean;
  verifiedAt: string;
};

export type User = {
  uid: string;
  type?: UserType;
  fullName: string;
  nationalId: string;
  phone: string;
  address: string;
  freezoneId?: string;
  email?: string;
  joinedAt: string;
  kyc: "APPROVED" | "PENDING" | "REJECTED";
  avatarColor: string;
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
  address: string;
  label: string;
  network: "BSC";
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
  | "SEND_REQUEST_RECEIVED"
  | "SEND_RATE_LOCKED"
  | "SEND_COMPLETED"
  | "FOREIGN_RECEIVE_REQUEST"
  | "FOREIGN_CRYPTO_RECEIVED";

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
  invoiceId?: string;
  direction: InvoiceDirection;
  amount: number;
  currency: Currency;
  counterpartyUid?: string;
  counterpartyName?: string;
  txHash: string;
  status: "CONFIRMED" | "PENDING" | "FAILED" | "UNMATCHED";
  createdAt: string;
  fromAddress: string;
  toAddress: string;
  confirmations: number;
  fee: number;
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
  bankFeePercent: number;
};
