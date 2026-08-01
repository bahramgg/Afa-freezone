import "server-only";
import { db } from "./db";
import { Prisma } from "@/lib/generated/prisma/client";
import { alreadyPosted, bankSpread, post, splitGatewayFee, unitFor } from "./ledger";
import type { Currency } from "@/lib/generated/prisma/client";

/**
 * The events that move value, written to the ledger as they happen.
 *
 * Kept apart from the flows themselves so each is described once and cannot
 * drift: an invoice being paid means the same thing to the books whether the
 * watcher noticed it or a buyer handed over the hash.
 */

async function freezonePercent(): Promise<Prisma.Decimal> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return new Prisma.Decimal(settings?.freezoneSharePercent ?? 50);
}

/**
 * A buyer's payment landed and the invoice is settled.
 *
 * The tokens sit at the deposit address until the operator sweeps them, and
 * against them stand two claims: what the merchant is owed, and the fee — split
 * there and then between the gateway and the organization, so neither share is
 * ever a figure someone has to work out later.
 */
export async function postInvoicePaid(invoice: {
  id: string;
  ref: string;
  ownerId: string;
  currency: Currency;
  receivedAmount: Prisma.Decimal | string | number;
  feeAmount: Prisma.Decimal | string | number;
  netAmount: Prisma.Decimal | string | number;
}): Promise<void> {
  if (await alreadyPosted("INVOICE_PAID", invoice.id)) return;

  const unit = unitFor(invoice.currency);
  const { gateway, freezone } = splitGatewayFee(invoice.feeAmount, await freezonePercent());

  await post(
    { kind: "INVOICE_PAID", subject: "invoice", subjectId: invoice.id, subjectRef: invoice.ref },
    [
      { account: "DEPOSIT_HELD", amount: invoice.receivedAmount, unit, note: "پرداخت خریدار" },
      {
        account: "MERCHANT_PAYABLE",
        amount: invoice.netAmount,
        unit,
        userId: invoice.ownerId,
        note: "سهم تاجر پس از کارمزد",
      },
      { account: "GATEWAY_SHARE", amount: gateway, unit, note: "سهم درگاه از کارمزد" },
      { account: "FREEZONE_SHARE", amount: freezone, unit, note: "سهم سازمان منطقه آزاد" },
    ],
  );
}

/** The operator moved a deposit address's balance into the bank's treasury. */
export async function postDepositSwept(deposit: {
  id: string;
  address: string;
  currency: Currency;
  amount: Prisma.Decimal | string | number;
}): Promise<void> {
  if (await alreadyPosted("DEPOSIT_SWEPT", deposit.id)) return;

  const unit = unitFor(deposit.currency);
  await post(
    {
      kind: "DEPOSIT_SWEPT",
      subject: "deposit",
      subjectId: deposit.id,
      subjectRef: deposit.address,
    },
    [
      { account: "DEPOSIT_HELD", amount: new Prisma.Decimal(deposit.amount).negated(), unit },
      { account: "BANK_HELD", amount: deposit.amount, unit },
    ],
  );
}

/**
 * A merchant handed crypto straight to the bank, outside any invoice.
 *
 * Same shape as an invoice payment except the tokens arrive in the treasury
 * rather than at a deposit address, because the merchant sent them there.
 */
export async function postSettlementFunded(settlement: {
  id: string;
  ref: string;
  ownerId: string;
  currency: Currency;
  amount: Prisma.Decimal | string | number;
  feeAmount: Prisma.Decimal | string | number;
  netAmount: Prisma.Decimal | string | number;
}): Promise<void> {
  if (await alreadyPosted("SETTLEMENT_FUNDED", settlement.id)) return;

  const unit = unitFor(settlement.currency);
  const { gateway, freezone } = splitGatewayFee(settlement.feeAmount, await freezonePercent());

  await post(
    {
      kind: "SETTLEMENT_FUNDED",
      subject: "settlement",
      subjectId: settlement.id,
      subjectRef: settlement.ref,
    },
    [
      { account: "BANK_HELD", amount: settlement.amount, unit, note: "کریپتوی دریافتی از تاجر" },
      {
        account: "MERCHANT_PAYABLE",
        amount: settlement.netAmount,
        unit,
        userId: settlement.ownerId,
      },
      { account: "GATEWAY_SHARE", amount: gateway, unit },
      { account: "FREEZONE_SHARE", amount: freezone, unit },
    ],
  );
}

/**
 * The bank paid the merchant their rial and the debt is discharged.
 *
 * The tokens stay where they are — the bank bought them — so what leaves the
 * books is the claim, not the balance. The bank's margin is recorded in rial
 * beside it, which is the only place that margin was ever visible.
 */
export async function postSettlementSettled(settlement: {
  id: string;
  ref: string;
  ownerId: string;
  currency: Currency;
  netAmount: Prisma.Decimal | string | number;
  spreadRial: Prisma.Decimal | string | number | null;
}): Promise<void> {
  if (await alreadyPosted("SETTLEMENT_SETTLED", settlement.id)) return;

  const unit = unitFor(settlement.currency);
  await post(
    {
      kind: "SETTLEMENT_SETTLED",
      subject: "settlement",
      subjectId: settlement.id,
      subjectRef: settlement.ref,
    },
    [
      {
        account: "MERCHANT_PAYABLE",
        amount: new Prisma.Decimal(settlement.netAmount).negated(),
        unit,
        userId: settlement.ownerId,
        note: "ریال به تاجر پرداخت شد",
      },
      {
        account: "BANK_HELD",
        amount: new Prisma.Decimal(settlement.netAmount).negated(),
        unit,
        note: "کریپتو در ازای ریال به بانک رسید",
      },
      {
        account: "BANK_SPREAD",
        amount: settlement.spreadRial ?? 0,
        unit: "IRR",
        note: "حاشیه صرافی بانک",
      },
    ],
  );
}

/** The bank delivered crypto to an importer's supplier and keeps the rial. */
export async function postSendCompleted(send: {
  id: string;
  ref: string;
  currency: Currency;
  feeAmount: Prisma.Decimal | string | number | null;
  spreadRial: Prisma.Decimal | string | number | null;
}): Promise<void> {
  if (await alreadyPosted("SEND_COMPLETED", send.id)) return;

  const unit = unitFor(send.currency);
  const { gateway, freezone } = splitGatewayFee(send.feeAmount ?? 0, await freezonePercent());

  await post(
    { kind: "SEND_COMPLETED", subject: "send", subjectId: send.id, subjectRef: send.ref },
    [
      { account: "GATEWAY_SHARE", amount: gateway, unit, note: "سهم درگاه از کارمزد" },
      { account: "FREEZONE_SHARE", amount: freezone, unit, note: "سهم سازمان منطقه آزاد" },
      { account: "BANK_SPREAD", amount: send.spreadRial ?? 0, unit: "IRR" },
    ],
  );
}

export { bankSpread };
