import { z } from "zod";
import { db } from "@/lib/server/db";
import {
  badRequest,
  handler,
  jsonOk,
  readJson,
  readQuery,
  requireApprovedMerchant,
  requireUser,
} from "@/lib/server/http";
import { nextRef } from "@/lib/server/refs";
import { serializeInvoice } from "@/lib/server/serialize";
import { recordTransition } from "@/lib/server/statusEvents";
import { notify, notifyRole } from "@/lib/server/notify";
import { isAddress, normalizeAddress } from "@/lib/server/chain/client";
import { invoiceScope, narrow } from "@/lib/server/scope";
import { feeFor } from "@/lib/server/fees";
import type { Prisma } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVOICE_INCLUDE = {
  owner: { select: { uid: true, fullName: true } },
  counterparty: { select: { uid: true, fullName: true } },
  chainTx: true,
} satisfies Prisma.InvoiceInclude;

const Query = z.object({
  status: z
    .enum(["ALL", "PENDING", "APPROVED", "PAYMENT_PENDING", "PAID", "EXPIRED", "REJECTED"])
    .default("ALL"),
  search: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

/**
 * Merchants see only their own invoices; admins see every invoice. The scope is
 * derived from the session, never from a client-supplied owner filter.
 */
export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const { status, search, take } = readQuery(request, Query);

  const where = narrow(
    invoiceScope(user),
    status === "ALL" ? null : { status },
    search
      ? {
          OR: [
            { ref: { contains: search, mode: "insensitive" } },
            { trxRef: { contains: search, mode: "insensitive" } },
            { senderName: { contains: search, mode: "insensitive" } },
            { owner: { fullName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : null,
  );

  const list = await db.invoice.findMany({
    where,
    include: INVOICE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take,
  });

  return jsonOk({ list: list.map(serializeInvoice) });
});

const CreateBody = z.object({
  /**
   * EXPORT is raised by the Iranian merchant against a foreign buyer; IMPORT by
   * the foreign seller against an Iranian importer. Either way the party who is
   * owed the money raises it.
   */
  direction: z.enum(["EXPORT", "IMPORT"]).default("EXPORT"),
  amount: z.number().positive("مبلغ باید بزرگ‌تر از صفر باشد"),
  // USDT only. The deposit watcher reads BEP-20 Transfer logs; a native BNB
  // transfer emits none, so a BNB invoice could never be credited on its own.
  currency: z.literal("USDT", { message: "فاکتور فقط با تتر (USDT) صادر می‌شود" }),
  description: z.string().trim().min(1, "شرح تراکنش الزامی است"),
  goodsTitle: z.string().trim().min(1, "عنوان کالا الزامی است"),
  /**
   * The buyer's account in this system. An export brings currency into the
   * country, so the payer cannot be a name typed into a box — they register,
   * quote their uid, and the invoice lands in their own dashboard.
   */
  counterpartyUid: z.string().trim().min(2, "شناسه طرف مقابل الزامی است"),
  /** Import only: the seller's own wallet, where the principal is paid. */
  beneficiaryWallet: z.string().trim().optional(),
  walletAddress: z.string().trim().optional(),
});

export const POST = handler(async (request: Request) => {
  // Parsed before the role check, because which role may raise it depends
  // on the direction.
  const input = await readJson(request, CreateBody);
  const importing = input.direction === "IMPORT";

  // Whoever is owed the money raises the invoice: the Iranian merchant when
  // exporting, the foreign seller when importing.
  const user = await requireApprovedMerchant(importing ? "FOREIGN" : "IRANIAN");

  const counterpartyRole = importing ? "IRANIAN" : "FOREIGN";
  const counterparty = await db.user.findFirst({
    where: { uid: input.counterpartyUid, role: counterpartyRole },
    select: { id: true, fullName: true, disabledAt: true },
  });
  if (!counterparty) {
    throw badRequest(
      importing
        ? `واردکنندهٔ ایرانی با شناسهٔ ${input.counterpartyUid} پیدا نشد`
        : `کاربر خارجی با شناسهٔ ${input.counterpartyUid} پیدا نشد — خریدار باید ابتدا در سامانه ثبت‌نام کند و شناسه‌اش را به شما بدهد`,
    );
  }
  if (counterparty.disabledAt) throw badRequest("حساب طرف مقابل غیرفعال است");

  if (importing && (!input.beneficiaryWallet || !isAddress(input.beneficiaryWallet))) {
    throw badRequest("آدرس کیف پول خودتان را برای دریافت وجه وارد کنید");
  }

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (settings) {
    if (input.amount < Number(settings.invoiceMinAmount)) {
      throw badRequest(`حداقل مبلغ فاکتور ${settings.invoiceMinAmount} ${input.currency} است`);
    }
    if (input.amount > Number(settings.invoiceMaxAmount)) {
      throw badRequest(`حداکثر مبلغ فاکتور ${settings.invoiceMaxAmount} ${input.currency} است`);
    }
  }

  if (input.walletAddress && !isAddress(input.walletAddress)) {
    throw badRequest("آدرس والت معتبر نیست");
  }

  const validity = settings?.invoiceValidityMinutes ?? 30;

  // The seller names what they want to receive; the fee goes on top of it, so
  // they are paid the figure on their commercial contract exactly.
  const fee = await feeFor(input.amount, "debit");

  const invoice = await db.$transaction(async (tx) => {
    const { ref, trxRef } = await nextRef("invoice", tx);
    const created = await tx.invoice.create({
      data: {
        ref,
        trxRef,
        ownerId: user.id,
        amount: input.amount.toString(),
        currency: input.currency,
        description: input.description,
        goodsTitle: input.goodsTitle,
        direction: input.direction,
        counterpartyId: counterparty.id,
        // Taken from the account rather than typed, so the name on the invoice
        // is the one that was verified at registration.
        senderName: counterparty.fullName,
        beneficiaryWallet: input.beneficiaryWallet
          ? normalizeAddress(input.beneficiaryWallet)
          : null,
        // The fee is settled at creation, so an importer is told the whole sum
        // they owe before the bank ever quotes a rate — and the bank supplies
        // currency for the amount plus the fee rather than the amount alone.
        feeAmount: fee.fee.toFixed(8),
        netAmount: input.amount.toString(),
        walletAddress: input.walletAddress ? normalizeAddress(input.walletAddress) : null,
        status: "PENDING",
        expiresAt: new Date(Date.now() + validity * 60_000),
      },
      include: INVOICE_INCLUDE,
    });
    await recordTransition(tx, {
      subject: "invoice",
      subjectId: created.id,
      fromStatus: null,
      toStatus: "PENDING",
      actor: "USER",
      actorUserId: user.id,
      note: "فاکتور ثبت شد",
    });
    return created;
  });

  await notifyRole("ADMIN", {
    kind: "INVOICE_SUBMITTED",
    title: "فاکتور جدید در انتظار تأیید",
    body: `فاکتور ${invoice.ref} از ${user.fullName} ثبت شد`,
    href: "/admin/invoices",
  });
  await notify(counterparty.id, {
    kind: "INVOICE_ADDRESSED",
    title: importing ? "صورتحساب واردات جدید" : "درخواست پرداخت جدید",
    body: `${user.fullName} فاکتور ${invoice.ref} را برای شما صادر کرد`,
    href: importing ? "/imports" : "/foreign/invoices",
  });

  return jsonOk({ invoice: serializeInvoice(invoice) }, { status: 201 });
});
