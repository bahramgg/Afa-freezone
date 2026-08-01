import "server-only";
import { db } from "./db";
import { nextRef } from "./refs";
import { notify, notifyRole } from "./notify";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Turns a paid invoice into the payout that finishes it.
 *
 * Before this existed the receive flow stopped at PAID: the foreign buyer's
 * money sat in the bank's wallet, the invoice recorded a net amount, and no
 * step anywhere moved that net amount to the merchant. The merchant's own
 * wallet was collected on the form and never read.
 *
 * The bank is the exchange on both sides of this system, so the payout is a
 * settlement: the bank keeps the crypto it is already holding and pays the
 * merchant its rial equivalent. That settlement differs from one a merchant
 * raises directly in two ways, both flagged by `sourceInvoiceId` — the merchant
 * sends no crypto, because the bank already has it, and no fee is charged,
 * because the invoice took it.
 */
export async function raisePayoutSettlement(invoice: {
  id: string;
  ref: string;
  ownerId: string;
  currency: Prisma.SettlementCreateInput["currency"];
  goodsTitle: string;
  netAmount: Prisma.Decimal | null;
  amount: Prisma.Decimal;
}): Promise<{ ref: string } | null> {
  // One invoice, one payout. The unique index backs this up if two callers race
  // — the watcher and a manually submitted hash can both land on the same
  // invoice — so a duplicate is a no-op rather than a second payment.
  const existing = await db.settlement.findUnique({
    where: { sourceInvoiceId: invoice.id },
    select: { ref: true },
  });
  if (existing) return existing;

  const payable = invoice.netAmount ?? invoice.amount;
  if (Number(payable) <= 0) return null;

  try {
    const settlement = await db.$transaction(async (tx) => {
      const { ref, trxRef } = await nextRef("settlement", tx);
      const row = await tx.settlement.create({
        data: {
          ref,
          trxRef,
          ownerId: invoice.ownerId,
          sourceInvoiceId: invoice.id,
          goodsTitle: invoice.goodsTitle,
          description: `تسویه خودکار فاکتور ${invoice.ref}`,
          amount: payable,
          currency: invoice.currency,
          // The crypto is already in the bank's wallet and the invoice paid the
          // fee, so there is nothing to send and nothing more to charge.
          walletAddress: null,
          payoutAccount: null,
          feeAmount: "0",
          netAmount: payable,
          // Admin already cleared the invoice; asking them again would be
          // reviewing the same money twice.
          status: "AWAITING_BANK",
        },
      });
      await tx.statusEvent.create({
        data: {
          subject: "settlement",
          subjectId: row.id,
          fromStatus: null,
          toStatus: "AWAITING_BANK",
          actor: "SYSTEM",
          note: `از فاکتور پرداخت‌شده ${invoice.ref} ایجاد شد`,
        },
      });
      return row;
    });

    await notify(invoice.ownerId, {
      kind: "SETTLEMENT_FROM_INVOICE",
      title: "تسویه فاکتور آغاز شد",
      body: `برای فاکتور ${invoice.ref} درخواست تسویه ${settlement.ref} ساخته شد — شماره حساب دریافت ریال را وارد کنید`,
      href: "/settlement",
    });
    await notifyRole("BANK", {
      kind: "SETTLEMENT_AWAITING_BANK",
      title: "تسویه فاکتور پرداخت‌شده",
      body: `درخواست ${settlement.ref} از فاکتور ${invoice.ref} — کریپتو نزد بانک است`,
      href: "/bank/settlement",
    });

    return { ref: settlement.ref };
  } catch (error) {
    // Losing the payout must not undo the payment that was already verified on
    // chain; an admin can raise it by hand from the invoice.
    console.error(`[payout] could not raise a settlement for ${invoice.ref}`, error);
    return null;
  }
}
