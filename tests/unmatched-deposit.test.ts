/**
 * Taking on a deposit that matched no invoice.
 *
 * The reconciliation queue is money that arrived at a watched address and
 * belongs to nothing the system knows about. Its "پیگیری" button used to raise
 * a success toast and write nothing anywhere — on the one screen that exists
 * for money nobody can account for, which is the worst place in the system to
 * tell an operator something was handled when no record was made.
 *
 * So the checks here are mostly about the database, not the response: the
 * question is whether anything survived the click.
 */
import { call, check, get, jar, post, run, signIn, STAFF, unique } from "./harness";

async function main() {
  const { db } = await import("@/lib/server/db");

  const admin = jar();
  const merchant = jar();
  const bank = jar();
  await signIn(admin, STAFF.admin);
  await signIn(merchant, STAFF.merchant);
  await signIn(bank, STAFF.bank);

  const hash = `0x${unique("f").replace(/[^a-z0-9]/g, "").padEnd(64, "0").slice(0, 64)}`;
  const stray = await db.chainTx.create({
    data: {
      hash,
      chainId: Number(process.env.CHAIN_ID ?? 31337),
      direction: "IN",
      status: "CONFIRMED",
      fromAddress: "0x1111111111111111111111111111111111111111",
      toAddress: "0x2222222222222222222222222222222222222222",
      currency: "USDT",
      amount: "42",
      rawValue: "42000000",
      confirmations: 20,
    },
  });
  console.log(`── a deposit nobody's invoice claims (${hash.slice(0, 12)}…)`);
  check("it is unmatched to begin with", stray.matchedAt === null);
  check("and nobody has taken it on", stray.flaggedAt === null);

  console.log("── only the organisation may take one on");
  const asMerchant = await post(merchant, `/api/transactions/${hash}/flag`, { flagged: true });
  check("a merchant is refused", asMerchant.body?.ok === false, asMerchant.body);
  const asBank = await post(bank, `/api/transactions/${hash}/flag`, { flagged: true });
  check("the bank is refused", asBank.body?.ok === false, asBank.body);
  const anon = await post(jar(), `/api/transactions/${hash}/flag`, { flagged: true });
  check("an anonymous caller is refused", anon.body?.ok === false, anon.body);

  const untouched = await db.chainTx.findUnique({ where: { hash } });
  check("and none of them left a mark", untouched?.flaggedAt === null, untouched?.flaggedAt);

  console.log("── the organisation takes it on");
  const taken = await post(admin, `/api/transactions/${hash}/flag`, {
    flagged: true,
    note: "در حال بررسی با بانک",
  });
  check("accepted", taken.body?.ok === true, taken.body);

  // The check the old button could never have passed: something was written.
  const flagged = await db.chainTx.findUnique({
    where: { hash },
    include: { flaggedBy: { select: { email: true } } },
  });
  check("the database records that it was taken on", !!flagged?.flaggedAt, flagged?.flaggedAt);
  check("by whom", flagged?.flaggedBy?.email === STAFF.admin, flagged?.flaggedBy?.email);
  check("and why", flagged?.flagNote === "در حال بررسی با بانک", flagged?.flagNote);

  console.log("── and the queue says so");
  const listed = await get(admin, "/api/transactions?unmatched=true");
  const row = (listed.body?.data?.list ?? []).find((t: { txHash: string }) => t.txHash === hash);
  check("the row is in the unmatched queue", !!row, listed.body?.data?.list?.length);
  check("carrying who took it on", !!row?.flaggedAt && !!row?.flaggedBy, {
    flaggedAt: row?.flaggedAt,
    flaggedBy: row?.flaggedBy,
  });

  console.log("── it leaves an audit trail");
  const logged = await db.auditLog.findFirst({
    where: { action: "CHAINTX_FLAGGED", subject: hash },
  });
  check("the act was recorded", !!logged, logged?.id);

  console.log("── and it can be put back");
  const released = await post(admin, `/api/transactions/${hash}/flag`, { flagged: false });
  check("accepted", released.body?.ok === true, released.body);
  const clear = await db.chainTx.findUnique({ where: { hash } });
  check("nobody holds it now", clear?.flaggedAt === null, clear?.flaggedAt);
  check("and the note went with it", clear?.flagNote === null, clear?.flagNote);

  console.log("── a deposit that found its invoice is not in this queue");
  await db.chainTx.update({ where: { hash }, data: { matchedAt: new Date() } });
  const matched = await post(admin, `/api/transactions/${hash}/flag`, { flagged: true });
  check("taking on a matched deposit is refused", matched.body?.ok === false, matched.body);
  check(
    "and the refusal says why",
    JSON.stringify(matched.body).includes("تطبیق"),
    matched.body?.error,
  );

  console.log("── an unknown hash is not found");
  const nowhere = await post(
    admin,
    "/api/transactions/0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef/flag",
    { flagged: true },
  );
  check("404", nowhere.status === 404, nowhere.status);

  // Leaves the queue as it was found.
  await db.chainTx.delete({ where: { hash } });
  const gone = await call(admin, "/api/transactions?unmatched=true");
  check(
    "the fixture cleaned up after itself",
    !(gone.body?.data?.list ?? []).some((t: { txHash: string }) => t.txHash === hash),
  );
}

run(main);
