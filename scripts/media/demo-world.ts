import "dotenv/config";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * A believable system, for the guides to photograph.
 *
 * The videos show the real panels, and a real panel with three rows of
 * `test-1` in it teaches nobody anything — an empty table is worse, because
 * the viewer never sees the thing being described. So this fills a scratch
 * database with a plausible few weeks of trade: names that read as names,
 * amounts that read as amounts, and at least one record sitting in every state
 * a screen has a column for.
 *
 * It writes to its own database and never to the one the app uses. Nothing here
 * is a fixture the tests depend on, and nothing here is ever served.
 */
const url = process.env.GUIDE_DATABASE_URL;
if (!url) throw new Error("GUIDE_DATABASE_URL is required — this must never touch the real database");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const IRANIAN = [
  { name: "شرکت بازرگانی آریا تجارت", email: "aria@demo.afa", nid: "0074512389" },
  { name: "صنایع غذایی سپهر", email: "sepehr@demo.afa", nid: "0069841273" },
  { name: "فرش دستباف کاشان", email: "kashan@demo.afa", nid: "1288457390" },
];

const FOREIGN = [
  { name: "Anatolia Imports Ltd", email: "anatolia@demo.afa", country: "ترکیه", passport: "TR7741285" },
  { name: "Shenzhen Hexing Trading", email: "hexing@demo.afa", country: "چین", passport: "CN9930471" },
  { name: "Gulf Star General Trading", email: "gulfstar@demo.afa", country: "امارات", passport: "AE4418823" },
];

const GOODS = [
  "فرش دستباف ۶ متری",
  "زعفران سرگل درجه یک",
  "پستهٔ اکبری",
  "خشکبار بسته‌بندی‌شده",
  "قطعات صنعتی",
  "کاشی و سرامیک",
];

const addr = (seed: number) =>
  "0x" + seed.toString(16).padStart(4, "0").repeat(10).slice(0, 40);

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600_000);

async function main() {
  console.log(`seeding the demo world into ${url!.replace(/:[^:@]*@/, ":***@")}`);

  for (const t of [
    "LedgerEntry", "StatusEvent", "ChainTx", "DepositAddress", "Settlement",
    "Invoice", "Notification", "Wallet", "Session", "OtpCode", "AllowedEmail",
    "AuditLog", "Settings", "User",
  ]) {
    await db.$executeRawUnsafe(`TRUNCATE "${t}" RESTART IDENTITY CASCADE`);
  }

  await db.settings.create({
    data: {
      id: 1,
      feeBasePercent: 2,
      feeMin: 1,
      feeMax: 500,
      usdtRate: 68400,
      bnbRate: 224000,
      invoiceValidityMinutes: 120,
      freezoneSharePercent: 50,
    },
  });

  const staff = await Promise.all(
    [
      { uid: "ADM-001", role: "ADMIN" as const, fullName: "کارشناس سازمان منطقه آزاد", email: "admin@demo.afa" },
      { uid: "BNK-001", role: "BANK" as const, fullName: "کارشناس ارزی بانک", email: "bank@demo.afa" },
      { uid: "SYS-001", role: "SUPERADMIN" as const, fullName: "مدیر سامانه", email: "system@demo.afa" },
    ].map((s) =>
      db.user.create({ data: { ...s, kyc: "APPROVED", avatarColor: "oklch(0.62 0.16 250)" } }),
    ),
  );

  // A staff role is only valid while its address is on the list, so without
  // these the organisation and the bank cannot sign in to be photographed.
  await db.allowedEmail.createMany({
    data: [
      { email: "admin@demo.afa", role: "ADMIN", note: "حساب نمایشی راهنما" },
      { email: "bank@demo.afa", role: "BANK", note: "حساب نمایشی راهنما" },
      { email: "system@demo.afa", role: "SUPERADMIN", note: "حساب نمایشی راهنما" },
    ],
  });

  const merchants = await Promise.all(
    IRANIAN.map((m, i) =>
      db.user.create({
        data: {
          uid: `IR-${String(101 + i).padStart(3, "0")}`,
          role: "IRANIAN",
          fullName: m.name,
          email: m.email,
          nationalId: m.nid,
          kyc: i === 2 ? "PENDING" : "APPROVED",
          createdAt: daysAgo(60 - i * 9),
          avatarColor: ["oklch(0.65 0.17 30)", "oklch(0.62 0.16 150)", "oklch(0.6 0.16 300)"][i]!,
        },
      }),
    ),
  );

  const buyers = await Promise.all(
    FOREIGN.map((f, i) =>
      db.user.create({
        data: {
          uid: `FOR-${String(201 + i).padStart(3, "0")}`,
          role: "FOREIGN",
          fullName: f.name,
          email: f.email,
          country: f.country,
          passportNo: f.passport,
          kyc: i === 2 ? "PENDING" : "APPROVED",
          createdAt: daysAgo(52 - i * 7),
          avatarColor: ["oklch(0.63 0.15 220)", "oklch(0.66 0.15 80)", "oklch(0.6 0.15 340)"][i]!,
        },
      }),
    ),
  );

  // Bank wallets, so the wallets screen has something on it.
  await db.wallet.createMany({
    data: [
      { address: addr(0xbb01), label: "کیف پول دریافت اصلی", ownerKind: "BANK", bankKind: "RECEIVE", verified: true, verifiedAt: daysAgo(70) },
      { address: addr(0xbb02), label: "کیف پول ارسال اصلی", ownerKind: "BANK", bankKind: "SEND", verified: true, verifiedAt: daysAgo(70) },
    ],
  });
  await db.wallet.create({
    data: { address: addr(0xaa01), label: "کیف پول اصلی", ownerKind: "USER", userId: merchants[0]!.id, verified: true, verifiedAt: daysAgo(40) },
  });

  // ── invoices, one in every state a screen has a column for ────────────────
  let seq = 1040;
  const invoice = async (o: {
    owner: string; buyer: string; amount: number; status: string;
    direction: "EXPORT" | "IMPORT"; goods: string; age: number;
    received?: number; pending?: number; rial?: number; rate?: number;
  }) => {
    seq += 1;
    const fee = Math.max(1, Math.min(500, o.amount * 0.02));
    return db.invoice.create({
      data: {
        ref: `INV-${seq}`,
        trxRef: `TRX-${seq}`,
        ownerId: o.owner,
        counterpartyId: o.buyer,
        direction: o.direction,
        amount: String(o.amount),
        currency: "USDT",
        description: o.goods,
        goodsTitle: o.goods,
        senderName: "—",
        status: o.status as never,
        feeAmount: String(fee),
        netAmount: String(o.amount - fee),
        receivedAmount: o.received != null ? String(o.received) : null,
        pendingAmount: String(o.pending ?? 0),
        rialAmount: o.rial != null ? String(o.rial) : null,
        exchangeRate: o.rate != null ? String(o.rate) : null,
        paymentAddress: ["PENDING"].includes(o.status) ? null : addr(0xd000 + seq),
        beneficiaryWallet: o.direction === "IMPORT" ? addr(0xf000 + seq) : null,
        depositAccount: o.direction === "IMPORT" ? "IR۶۲۰۱۷۰۰۰۰۰۰۰۳۳۸۱۲۴۷۲۰۰۱" : null,
        createdAt: daysAgo(o.age),
        updatedAt: daysAgo(Math.max(0, o.age - 1)),
        paidAt: o.status === "PAID" ? daysAgo(Math.max(0, o.age - 2)) : null,
        expiresAt: new Date(Date.now() + 3600_000 * 6),
      },
    });
  };

  const [m0, m1] = [merchants[0]!.id, merchants[1]!.id];
  const [b0, b1, b2] = [buyers[0]!.id, buyers[1]!.id, buyers[2]!.id];

  await invoice({ owner: m0, buyer: b0, amount: 12500, status: "PAID", direction: "EXPORT", goods: GOODS[0]!, age: 21, received: 12500 });
  await invoice({ owner: m0, buyer: b1, amount: 8400, status: "PAID", direction: "EXPORT", goods: GOODS[1]!, age: 17, received: 8400 });
  await invoice({ owner: m1, buyer: b0, amount: 6200, status: "PAID", direction: "EXPORT", goods: GOODS[2]!, age: 12, received: 6200 });
  await invoice({ owner: m0, buyer: b2, amount: 4800, status: "APPROVED", direction: "EXPORT", goods: GOODS[3]!, age: 3, pending: 4800 });
  await invoice({ owner: m1, buyer: b1, amount: 9750, status: "PENDING", direction: "EXPORT", goods: GOODS[4]!, age: 1 });
  await invoice({ owner: m0, buyer: b1, amount: 3100, status: "PAYMENT_PENDING", direction: "EXPORT", goods: GOODS[5]!, age: 2, received: 1800 });

  await invoice({ owner: m0, buyer: b1, amount: 15000, status: "PAID", direction: "IMPORT", goods: "ماشین‌آلات بسته‌بندی", age: 25, received: 15300, rial: 1_046_520_000, rate: 68400 });
  await invoice({ owner: m1, buyer: b2, amount: 7300, status: "RIAL_RECEIVED", direction: "IMPORT", goods: "مواد اولیهٔ صنعتی", age: 5, rial: 509_431_200, rate: 68400 });
  await invoice({ owner: m0, buyer: b0, amount: 5400, status: "BANK_RATE_LOCKED", direction: "IMPORT", goods: "قطعات یدکی", age: 4, rial: 376_876_800, rate: 68400 });
  await invoice({ owner: m1, buyer: b0, amount: 2600, status: "APPROVED", direction: "IMPORT", goods: "لوازم آزمایشگاهی", age: 2 });

  // ── settlements: the rial the bank owes a merchant for an export ──────────
  let sq = 310;
  const settlement = async (o: { owner: string; amount: number; status: string; age: number; rial?: number }) => {
    sq += 1;
    return db.settlement.create({
      data: {
        ref: `SET-${sq}`,
        trxRef: `TRX-${sq}`,
        ownerId: o.owner,
        goodsTitle: "تسویهٔ صادرات",
        description: "برگشت ارز حاصل از صادرات",
        amount: String(o.amount),
        currency: "USDT",
        feeAmount: String(o.amount * 0.02),
        netAmount: String(o.amount * 0.98),
        rialAmount: o.rial != null ? String(o.rial) : null,
        exchangeRate: o.rial != null ? "68400" : null,
        payoutAccount: "IR۳۵۰۱۲۰۰۰۰۰۰۰۸۸۴۵۲۰۱۹۳۰۰۱",
        status: o.status as never,
        createdAt: daysAgo(o.age),
        updatedAt: daysAgo(Math.max(0, o.age - 1)),
        settledAt: o.status === "SETTLED" ? daysAgo(Math.max(0, o.age - 2)) : null,
      },
    });
  };

  await settlement({ owner: m0, amount: 12250, status: "SETTLED", age: 19, rial: 837_900_000 });
  await settlement({ owner: m0, amount: 8232, status: "SETTLED", age: 15, rial: 563_068_800 });
  await settlement({ owner: m1, amount: 6076, status: "AWAITING_BANK", age: 6, rial: 415_598_400 });
  await settlement({ owner: m0, amount: 4704, status: "AWAITING_ADMIN", age: 2 });

  // ── deposit addresses, so the bank's screen is not an empty page ──────────
  //
  // Each invoice's payment address is a real row here in the running system —
  // the watcher scans them and the bank releases them — and without it the
  // bank's own deposits screen says "no address has been made yet", which is
  // the screen a guide is about to describe.
  const quoted = await db.invoice.findMany({ where: { paymentAddress: { not: null } } });
  for (const [i, inv] of quoted.entries()) {
    const fee = Number(inv.feeAmount ?? 0);
    const settled = inv.status === "PAID";
    await db.depositAddress.create({
      data: {
        index: 100 + i,
        address: inv.paymentAddress!,
        invoiceId: inv.id,
        receivedAmount: settled ? inv.amount : "0",
        terms: {
          invoiceRef: inv.ref,
          feeBps: 200,
          freezoneBps: 5000,
          feeMin: String(BigInt(1) * 10n ** 6n),
          feeMax: String(BigInt(500) * 10n ** 6n),
          token: addr(0x7175),
          gatewayWallet: addr(0xc001),
          freezoneWallet: addr(0xc002),
          beneficiary: inv.beneficiaryWallet ?? addr(0xc003),
        },
        sweptAt: settled ? inv.paidAt : null,
        sweepTxHash: settled ? "0x" + (0xfee000 + i).toString(16).padStart(64, "5") : null,
        createdAt: inv.createdAt,
      },
    });
    void fee;
  }

  // ── the books, so the ledger screen is not an empty page ──────────────────
  const paid = await db.invoice.findMany({ where: { status: "PAID", direction: "EXPORT" } });
  for (const inv of paid) {
    const fee = Number(inv.feeAmount ?? 0);
    await db.ledgerEntry.createMany({
      data: [
        { account: "DEPOSIT_HELD", kind: "INVOICE_PAID", subjectRef: inv.ref, unit: "USDT", amount: inv.amount, note: "پرداخت خریدار", createdAt: inv.paidAt! },
        { account: "MERCHANT_PAYABLE", kind: "INVOICE_PAID", subjectRef: inv.ref, unit: "USDT", amount: String(Number(inv.amount) - fee), userId: inv.ownerId, note: "طلب بازرگان", createdAt: inv.paidAt! },
        { account: "GATEWAY_SHARE", kind: "INVOICE_PAID", subjectRef: inv.ref, unit: "USDT", amount: String(fee / 2), note: "سهم درگاه", createdAt: inv.paidAt! },
        { account: "FREEZONE_SHARE", kind: "INVOICE_PAID", subjectRef: inv.ref, unit: "USDT", amount: String(fee / 2), note: "سهم سازمان", createdAt: inv.paidAt! },
      ],
    });
  }

  // ── on-chain activity, including one deposit nobody's invoice claims ───────
  const withAddress = await db.invoice.findMany({ where: { paymentAddress: { not: null } }, take: 6 });
  for (const [i, inv] of withAddress.entries()) {
    const tx = await db.chainTx.create({
      data: {
        hash: "0x" + (0xabc000 + i).toString(16).padStart(64, "3"),
        chainId: 11155111,
        direction: "IN",
        status: inv.status === "PAID" ? "CONFIRMED" : "CONFIRMING",
        fromAddress: addr(0xe100 + i),
        toAddress: inv.paymentAddress!,
        currency: "USDT",
        amount: inv.amount,
        rawValue: String(Number(inv.amount) * 1e6),
        blockNumber: BigInt(11425600 + i * 37),
        confirmations: inv.status === "PAID" ? 240 : 6,
        matchedAt: inv.status === "PAID" ? inv.paidAt : null,
        seenAt: daysAgo(6 - i),
      },
    });
    // The invoice points at the transfer that paid it. Without this the panels
    // show a merchant no transactions at all, which is the one thing a guide
    // about their transactions must not do.
    await db.invoice.update({ where: { id: inv.id }, data: { chainTxId: tx.id } });
  }
  await db.chainTx.create({
    data: {
      hash: "0x" + "9".repeat(64),
      chainId: 11155111,
      direction: "IN",
      status: "CONFIRMED",
      fromAddress: addr(0xe900),
      toAddress: addr(0xbb01),
      currency: "USDT",
      amount: "1750",
      rawValue: "1750000000",
      blockNumber: 11425910n,
      confirmations: 180,
      seenAt: daysAgo(1),
    },
  });

  // Notifications, so the bell is not empty in a screenshot.
  await db.notification.createMany({
    data: [
      { userId: m0, kind: "PAYMENT_RECEIVED", title: "پرداخت دریافت شد", body: "پرداخت فاکتور INV-1041 روی شبکه تأیید شد", createdAt: daysAgo(1) },
      { userId: m0, kind: "INVOICE_APPROVED", title: "فاکتور تأیید شد", body: "فاکتور INV-1044 تأیید و آدرس پرداخت صادر شد", createdAt: daysAgo(2) },
      { userId: staff[0]!.id, kind: "KYC_SUBMITTED", title: "درخواست احراز هویت جدید", body: "فرش دستباف کاشان (IR-103) ثبت‌نام کرد", createdAt: daysAgo(1) },
    ],
  });

  const counts = {
    users: await db.user.count(),
    invoices: await db.invoice.count(),
    settlements: await db.settlement.count(),
    ledger: await db.ledgerEntry.count(),
    chainTx: await db.chainTx.count(),
  };
  console.log("demo world:", JSON.stringify(counts));
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exitCode = 1;
});
