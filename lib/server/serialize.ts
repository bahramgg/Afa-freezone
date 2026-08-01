import "server-only";
import type {
  Invoice,
  Notification,
  SendRequest,
  Settlement,
  Settings,
  User,
  Wallet,
  ChainTx,
  Prisma,
} from "@/lib/generated/prisma/client";

/**
 * Prisma returns Decimal and BigInt, neither of which survives JSON. Every
 * response goes through these so the client keeps receiving the plain numbers
 * and ISO strings the existing UI is written against.
 */
const num = (d: Prisma.Decimal | null | undefined): number | undefined =>
  d == null ? undefined : Number(d);

const iso = (d: Date | null | undefined): string | undefined => d?.toISOString();

type WithOwner = { owner?: Pick<User, "uid" | "fullName"> | null };
type WithChainTx = { chainTx?: ChainTx | null };

export function serializeUser(u: User) {
  return {
    id: u.id,
    uid: u.uid,
    role: u.role,
    fullName: u.fullName,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    nationalId: u.nationalId ?? undefined,
    freezoneId: u.freezoneId ?? undefined,
    passportNo: u.passportNo ?? undefined,
    country: u.country ?? undefined,
    address: u.address ?? undefined,
    avatarColor: u.avatarColor,
    kyc: u.kyc,
    kycRejectReason: u.kycRejectReason ?? undefined,
    joinedAt: u.createdAt.toISOString(),
    disabled: !!u.disabledAt,
  };
}

export function serializeWallet(w: Wallet) {
  return {
    id: w.id,
    address: w.address,
    label: w.label,
    network: "BSC" as const,
    ownerKind: w.ownerKind,
    bankKind: w.bankKind ?? undefined,
    active: w.active,
    verified: w.verified,
    // Null while unverified — falling back to createdAt would print a
    // verification date for a wallet nobody has proven they hold.
    verifiedAt: iso(w.verifiedAt) ?? null,
    createdAt: w.createdAt.toISOString(),
  };
}

export function serializeInvoice(i: Invoice & WithOwner & WithChainTx) {
  return {
    id: i.ref,
    dbId: i.id,
    trxId: i.trxRef,
    direction: "RECEIVE" as const,
    amount: Number(i.amount),
    currency: i.currency,
    description: i.description,
    goodsTitle: i.goodsTitle,
    senderName: i.senderName,
    status: i.status,
    paymentAddress: i.paymentAddress ?? "",
    receivedAmount: num(i.receivedAmount),
    walletAddress: i.walletAddress ?? undefined,
    feeAmount: num(i.feeAmount),
    fee: num(i.feeAmount),
    netAmount: num(i.netAmount),
    rejectReason: i.rejectReason ?? undefined,
    txHash: i.chainTx?.hash ?? undefined,
    confirmations: i.chainTx?.confirmations,
    userUid: i.owner?.uid,
    userName: i.owner?.fullName,
    counterpartyName: i.senderName,
    expiresAt: iso(i.expiresAt),
    paidAt: iso(i.paidAt),
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

type TradeDoc = {
  id: string;
  kind: string;
  number: string;
  issuedAt: Date | null;
  issuer: string | null;
};

type SendWithParties = SendRequest &
  WithOwner &
  WithChainTx & {
    counterparty?: Pick<User, "uid" | "fullName"> | null;
    documents?: TradeDoc[];
  };

export function serializeDocument(d: TradeDoc) {
  return {
    id: d.id,
    kind: d.kind,
    number: d.number,
    issuedAt: iso(d.issuedAt),
    issuer: d.issuer ?? undefined,
  };
}

export function serializeSend(s: SendWithParties) {
  return {
    id: s.ref,
    dbId: s.id,
    trxId: s.trxRef,
    amount: Number(s.amount),
    currency: s.currency,
    description: s.description ?? undefined,
    status: s.status,
    userUid: s.owner?.uid,
    userName: s.owner?.fullName,
    counterpartyUid: s.counterparty?.uid ?? s.counterpartyUid,
    counterpartyName: s.counterparty?.fullName ?? s.counterpartyName ?? undefined,
    counterpartyEmail: s.counterpartyEmail ?? undefined,
    recipientConfirmed: s.recipientConfirmed,
    documents: s.documents?.map(serializeDocument),
    exchangeRate: num(s.exchangeRate),
    rateLocked: s.rateLocked,
    rialAmount: num(s.rialAmount),
    feeAmount: num(s.feeAmount),
    netAmount: num(s.netAmount),
    bankSpreadRial: num(s.bankSpreadRial),
    depositAccount: s.depositAccount ?? undefined,
    rialReceiptNo: s.rialReceiptNo ?? undefined,
    rialDepositAt: iso(s.rialDepositAt),
    recipientWalletAddress: s.recipientWalletAddress ?? undefined,
    bankWalletAddress: s.bankWalletAddress ?? undefined,
    txHashFromBank: s.chainTx?.hash ?? undefined,
    txHash: s.chainTx?.hash ?? undefined,
    confirmations: s.chainTx?.confirmations,
    rejectedBy: s.rejectedBy ?? undefined,
    rejectReason: s.rejectReason ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function serializeSettlement(s: Settlement & WithOwner & WithChainTx) {
  return {
    id: s.ref,
    dbId: s.id,
    trxId: s.trxRef,
    goodsTitle: s.goodsTitle,
    description: s.description,
    amount: Number(s.amount),
    currency: s.currency,
    walletAddress: s.walletAddress ?? undefined,
    payoutAccount: s.payoutAccount ?? undefined,
    /** Set when this payout came from a paid invoice rather than a merchant. */
    sourceInvoiceId: s.sourceInvoiceId ?? undefined,
    status: s.status,
    userUid: s.owner?.uid,
    userName: s.owner?.fullName,
    exchangeRate: num(s.exchangeRate),
    rateLocked: s.rateLocked,
    rialAmount: num(s.rialAmount),
    feeAmount: num(s.feeAmount),
    netAmount: num(s.netAmount),
    bankSpreadRial: num(s.bankSpreadRial),
    bankWalletAddress: s.bankWalletAddress ?? undefined,
    bankResponseAt: iso(s.bankResponseAt),
    bankResponseNote: s.bankResponseNote ?? undefined,
    rialReceiptNo: s.rialReceiptNo ?? undefined,
    rialDepositAt: iso(s.rialDepositAt),
    settledAt: iso(s.settledAt),
    txHash: s.chainTx?.hash ?? "",
    userPayoutTxHash: s.chainTx?.hash ?? undefined,
    confirmations: s.chainTx?.confirmations,
    rejectedBy: s.rejectedBy ?? undefined,
    rejectReason: s.rejectReason ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function serializeChainTx(t: ChainTx) {
  return {
    id: t.id,
    txHash: t.hash,
    direction: t.direction === "IN" ? ("RECEIVE" as const) : ("SEND" as const),
    status: t.status,
    fromAddress: t.fromAddress,
    toAddress: t.toAddress,
    currency: t.currency,
    amount: Number(t.amount),
    confirmations: t.confirmations,
    fee: num(t.gasFee) ?? 0,
    blockNumber: t.blockNumber?.toString(),
    matched: !!t.matchedAt,
    createdAt: t.seenAt.toISOString(),
  };
}

export function serializeNotification(n: Notification) {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href ?? undefined,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  };
}

export function serializeSettings(s: Settings) {
  return {
    feeBasePercent: Number(s.feeBasePercent),
    feeMin: Number(s.feeMin),
    feeMax: Number(s.feeMax),
    invoiceValidityMinutes: s.invoiceValidityMinutes,
    invoiceMinAmount: Number(s.invoiceMinAmount),
    invoiceMaxAmount: Number(s.invoiceMaxAmount),
    usdtRate: Number(s.usdtRate),
    bnbRate: Number(s.bnbRate),
    dailySendLimit: Number(s.dailySendLimit),
    dailySettlementLimit: Number(s.dailySettlementLimit),
    minTxAmount: Number(s.minTxAmount),
    rateTolerancePercent: Number(s.rateTolerancePercent),
    freezoneSharePercent: Number(s.freezoneSharePercent),
  };
}
