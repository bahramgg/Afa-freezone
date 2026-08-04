import { check, db, get, jar, post, run, signIn, STAFF, step, unique } from "./harness";

/**
 * A staff role exists only while its address is on the access list.
 *
 * The bank moves currency and the organization clears the invoices that let it
 * move — so "who is the bank" cannot be a thing that quietly accumulates. It is
 * one list, in one place, and taking an address off it takes the panel away in
 * the same moment rather than whenever a cookie happens to expire.
 *
 * Merchants are untouched by any of this: anyone may still sign in and trade.
 */
async function main() {
  const system = jar();
  await signIn(system, STAFF.system);

  const bankEmail = `${unique("access.bank")}@afa.local`;
  const strangerEmail = `${unique("access.stranger")}@afa.local`;

  step("an address nobody listed is a merchant, not an operator");
  const stranger = jar();
  await signIn(stranger, strangerEmail);
  const asStranger = await get(stranger, "/api/auth/me");
  check(
    "they get in",
    asStranger.body?.data?.user?.role === "IRANIAN",
    asStranger.body?.data?.user?.role,
  );
  check(
    "and the bank's queue is shut to them",
    (await get(stranger, "/api/deposits")).status === 403,
  );

  step("the system administrator names a bank operator");
  const added = await post(system, "/api/system/access", {
    action: "add",
    email: bankEmail,
    role: "BANK",
    note: "کارشناس ارزی آزمون",
  });
  check("the entry is created as BANK", added.body?.data?.entry?.role === "BANK", added.body);

  const listed = await get(system, "/api/system/access");
  const entry = (listed.body?.data?.list ?? []).find((e: any) => e.email === bankEmail);
  check("it is on the operator side of the list", entry?.staff === true, entry);
  check("with nobody behind it yet", entry?.accountUid === undefined, entry?.accountUid);

  step("that address signs in and lands in the bank");
  const operator = jar();
  const signedIn = await signIn(operator, bankEmail);
  check("the account is created as BANK", signedIn.body?.data?.user?.role === "BANK", signedIn.body?.data?.user);
  check("and is sent to the bank's panel", signedIn.body?.data?.home === "/bank/dashboard", signedIn.body?.data?.home);
  check("its uid is a bank uid", /^BNK-\d+$/.test(signedIn.body?.data?.user?.uid ?? ""), signedIn.body?.data?.user?.uid);
  check("the bank's queue opens for them", (await get(operator, "/api/deposits")).status === 200);

  step("moving the entry moves the account with it");
  await post(system, "/api/system/access", { action: "setRole", email: bankEmail, role: "ADMIN" });
  const moved = await db.user.findUnique({ where: { email: bankEmail } });
  check("the account is now the organisation's", moved?.role === "ADMIN", moved?.role);
  const liveAfterMove = await db.session.count({
    where: { user: { email: bankEmail }, revokedAt: null },
  });
  check("and the sessions it held under the old role are cut", liveAfterMove === 0, liveAfterMove);

  step("taking the address off the list shuts the door");
  await post(system, "/api/system/access", { action: "remove", email: bankEmail });

  const refused = await post(jar(), "/api/auth/otp/request", { email: bankEmail });
  check("no code is even sent", refused.status === 403, { status: refused.status, body: refused.body?.error });
  check(
    "and the reason names the panel they lost",
    String(refused.body?.error?.message ?? "").includes("لغو"),
    refused.body?.error?.message,
  );

  const stillLive = await db.session.count({
    where: { user: { email: bankEmail }, revokedAt: null },
  });
  check("nothing of theirs is still signed in", stillLive === 0, stillLive);

  step("the account survives — it is the access that was revoked");
  const account = await db.user.findUnique({ where: { email: bankEmail } });
  check("the record is still there", Boolean(account), account?.uid);
  check("it was not silently turned into a merchant", account?.role === "ADMIN", account?.role);

  step("merchants are unaffected by any of it");
  const merchant = jar();
  await signIn(merchant, `${unique("access.merchant")}@afa.local`);
  const me = await get(merchant, "/api/auth/me");
  check("a brand new address still gets a merchant account", me.body?.data?.user?.role === "IRANIAN", me.body?.data?.user?.role);

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  check("because registration is still open to everyone", settings?.registrationRestricted !== true, settings?.registrationRestricted);

  step("the seeded operators are on the list — otherwise every panel is locked");
  const staffEntries = await db.allowedEmail.findMany({
    where: { role: { in: ["ADMIN", "BANK", "SUPERADMIN"] } },
    select: { email: true, role: true },
  });
  for (const [label, email] of [
    ["organisation", STAFF.admin],
    ["bank", STAFF.bank],
    ["system", STAFF.system],
  ]) {
    check(`the ${label} address is listed`, staffEntries.some((e) => e.email === email), email);
  }

  step("a system administrator cannot lock themselves out");
  const selfRemove = await post(system, "/api/system/access", {
    action: "remove",
    email: STAFF.system,
  });
  check("removing your own access is refused", selfRemove.body?.ok === false, selfRemove.body);
  check(
    "and the entry is untouched",
    Boolean(await db.allowedEmail.findUnique({ where: { email: STAFF.system } })),
  );

  step("only a system administrator may read or change the list");
  const admin = jar();
  await signIn(admin, STAFF.admin);
  check("the organisation cannot read it", (await get(admin, "/api/system/access")).status === 403);
  check(
    "nor add to it",
    (await post(admin, "/api/system/access", { action: "add", email: "x@afa.local", role: "BANK" }))
      .status === 403,
  );

  // Leaves the world as it was found.
  await db.allowedEmail.deleteMany({ where: { email: { in: [bankEmail] } } });
  await db.user.deleteMany({ where: { email: { in: [bankEmail, strangerEmail] } } });
}

run(main);
