/**
 * What the money does when the payment is not the clean one.
 *
 * The four role audits ask who may press what. This asks the harder question:
 * when the amount is wrong, when the payer pays twice, when the watcher runs
 * twice, when the same transfer is replayed — does the system still end up
 * describing what actually happened on the chain?
 *
 * Every figure here is read back off the chain or out of the books, never from
 * the response that claimed it.
 */
import { chain, check, ensureMerchant, jar, post, run, signIn, step, STAFF, unique } from "./harness";

process.env.CHAIN_FINALITY = "confirmations";
process.env.CHAIN_MIN_CONFIRMATIONS = "1";

async function main() {
  const { db } = await import("@/lib/server/db");
  const c = await chain();

  const admin = jar();
  const merchant = jar();
  await signIn(admin, STAFF.admin);
  await ensureMerchant();
  await signIn(merchant, STAFF.merchant);

  const buyerJar = jar();
  const reg = await post(buyerJar, "/api/auth/register", {
    fullName: "Audit Money Buyer Ltd",
    email: unique("audm") + "@example.com",
    passportNo: "AM1",
    country: "Türkiye",
  });
  const buyerUid = reg.body?.data?.user?.uid as string;
  await post(admin, `/api/admin/kyc/${buyerUid}`, { action: "approve" });

  /** An approved export invoice with an address, ready to be paid. */
  const openInvoice = async (amount: number) => {
    const made = await post(merchant, "/api/invoices", {
      amount,
      currency: "USDT",
      description: `ارزیابی پول ${unique("k")}`,
      goodsTitle: "کالای ارزیابی",
      counterpartyUid: buyerUid,
    });
    const ref = made.body?.data?.invoice?.id as string;
    const approved = await post(admin, `/api/invoices/${ref}/transition`, { action: "approve" });
    return { ref, address: approved.body?.data?.invoice?.paymentAddress as string };
  };

  step("paying less than the invoice leaves it open at the same address");
  {
    const { ref, address } = await openInvoice(100);
    await c.mint(c.operator.address, "100");
    await c.transfer(address, "40");
    await c.settle();

    const row = await db.invoice.findUnique({ where: { ref } });
    check("the invoice is not marked paid", row?.status === "PAYMENT_PENDING", row?.status);
    check("and is credited exactly what arrived", Number(row?.receivedAmount) === 40, row?.receivedAmount?.toString());

    // The rest, to the same address — the point of leaving it open.
    await c.transfer(address, "60");
    await c.settle();
    const after = await db.invoice.findUnique({ where: { ref } });
    check("topping it up settles it", after?.status === "PAID", after?.status);
    check("at the full amount", Number(after?.receivedAmount) === 100, after?.receivedAmount?.toString());
    check("and the address holds the whole 100", Number(await c.balanceOf(address)) === 100, await c.balanceOf(address));
  }

  step("paying more than the invoice credits what actually arrived");
  {
    const { ref, address } = await openInvoice(50);
    await c.mint(c.operator.address, "80");
    await c.transfer(address, "80");
    await c.settle();

    const row = await db.invoice.findUnique({ where: { ref } });
    check("the invoice settles", row?.status === "PAID", row?.status);
    check("credited with the 80 that came, not the 50 asked for", Number(row?.receivedAmount) === 80, row?.receivedAmount?.toString());

    const entries = await db.ledgerEntry.findMany({ where: { subjectRef: ref, kind: "INVOICE_PAID" } });
    const held = entries.find((e) => e.account === "DEPOSIT_HELD");
    check("and the books record the 80 as well", Number(held?.amount) === 80, held?.amount?.toString());
  }

  step("running the watcher again changes nothing");
  {
    const { ref, address } = await openInvoice(70);
    await c.mint(c.operator.address, "70");
    await c.transfer(address, "70");
    await c.settle();

    const before = await db.ledgerEntry.count({ where: { subjectRef: ref } });
    const beforeRow = await db.invoice.findUnique({ where: { ref } });
    await c.settle();
    await c.settle();
    const after = await db.ledgerEntry.count({ where: { subjectRef: ref } });
    const afterRow = await db.invoice.findUnique({ where: { ref } });

    check("the books are not written twice", after === before, { before, after });
    check("the amount does not double", Number(afterRow?.receivedAmount) === Number(beforeRow?.receivedAmount), {
      before: beforeRow?.receivedAmount?.toString(),
      after: afterRow?.receivedAmount?.toString(),
    });
    check("and the status is unchanged", afterRow?.status === beforeRow?.status, afterRow?.status);
  }

  step("one buyer's payment cannot settle another buyer's invoice");
  {
    const a = await openInvoice(30);
    const b = await openInvoice(30);
    check("two invoices, two different addresses", a.address !== b.address, { a: a.address, b: b.address });

    await c.mint(c.operator.address, "30");
    await c.transfer(a.address, "30");
    await c.settle();

    const rowA = await db.invoice.findUnique({ where: { ref: a.ref } });
    const rowB = await db.invoice.findUnique({ where: { ref: b.ref } });
    check("the one that was paid is paid", rowA?.status === "PAID", rowA?.status);
    check("the other is untouched", rowB?.status === "APPROVED", rowB?.status);
    check("and was credited nothing", !rowB?.receivedAmount || Number(rowB.receivedAmount) === 0, rowB?.receivedAmount?.toString());
  }

  step("a transfer to an address the gateway never quoted is not credited to anyone");
  {
    const stray = "0x" + "ab".repeat(20);
    await c.mint(c.operator.address, "25");
    await c.transfer(stray, "25");
    await c.settle();

    const tx = await db.chainTx.findFirst({ where: { toAddress: stray.toLowerCase() } });
    check("the transfer is not adopted by any invoice", !tx || !tx.matchedAt, tx?.matchedAt);
    const credited = await db.invoice.findFirst({ where: { receivedAmount: 25, description: { contains: "ارزیابی پول" } } });
    check("and no invoice was credited with it", !credited, credited?.ref);
  }

  step("what the books say matches what the chain holds");
  {
    const paid = await db.invoice.findMany({
      where: { description: { contains: "ارزیابی پول" }, status: "PAID" },
      select: { ref: true, paymentAddress: true, receivedAmount: true },
    });
    check("there are settled invoices to compare", paid.length > 0, paid.length);

    const wrong: unknown[] = [];
    for (const inv of paid) {
      if (!inv.paymentAddress) continue;
      const onChain = Number(await c.balanceOf(inv.paymentAddress));
      const booked = Number(inv.receivedAmount ?? 0);
      // The address still holds it — nothing here has been released.
      if (Math.abs(onChain - booked) > 1e-6) wrong.push({ ref: inv.ref, onChain, booked });
    }
    check(`every settled invoice's figure matches its address (${paid.length} checked)`, wrong.length === 0, wrong.slice(0, 3));
  }

  await db.invoice.deleteMany({ where: { description: { contains: "ارزیابی پول" } } });
}

run(main);
