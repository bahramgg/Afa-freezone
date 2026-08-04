/**
 * One email door for four panels, a link that works as well as the code, and a
 * system administrator who can see and stop everyone.
 */

import type { Jar } from "./harness";
import { call, check, jar, patch, post, run } from "./harness";

/** Signs in by typing the code, the way a person would. */
async function signIn(j: Jar, email: string) {
  const req = await post(j, "/api/auth/otp/request", { email });
  if (!req.body?.data?.devCode) return { ok: false, req };
  const v = await post(j, "/api/auth/otp/verify", { email, code: req.body.data.devCode });
  return { ok: v.body?.ok === true, v, req };
}

async function main() {
  const { db } = await import("@/lib/server/db");

  console.log("── the password door is gone");
  const pw = await post(jar(), "/api/auth/login", { email: "admin@afa.local", password: "x", portal: "admin" });
  check("POST /api/auth/login no longer exists", pw.status === 404, pw.status);

  console.log("── every role signs in with the same email form");
  for (const [email, role, home] of [
    ["admin@afa.local", "ADMIN", "/admin/dashboard"],
    ["bank@afa.local", "BANK", "/bank/dashboard"],
    ["system@afa.local", "SUPERADMIN", "/system/users"],
  ] as const) {
    const j = jar();
    const { ok, v } = await signIn(j, email);
    check(`${email} → ${role}`, ok && v?.body?.data?.user?.role === role, v?.body);
    check(`  and lands on ${home}`, v?.body?.data?.home === home, v?.body?.data?.home);
  }

  console.log("── an address nobody has seen becomes a merchant awaiting KYC");
  const fresh = `new.${Date.now()}@afa.local`;
  const j = jar();
  const { ok, v } = await signIn(j, fresh);
  check("signed in", ok, v?.body);
  check("as an Iranian merchant", v?.body?.data?.user?.role === "IRANIAN", v?.body?.data?.user?.role);
  check("registered, not merely logged in", v?.body?.data?.isNew === true, v?.body?.data);
  check("and still pending KYC", v?.body?.data?.hasPassedKyc === false, v?.body?.data);

  console.log("── the emailed link works instead of the code");
  const linkJar = jar();
  const req = await post(linkJar, "/api/auth/otp/request", { email: "admin@afa.local" });
  const link = req.body?.data?.devLink as string | undefined;
  check("a link was issued alongside the code", Boolean(link?.includes("/login/verify?token=")), link);
  const token = link ? new URL(link).searchParams.get("token")! : "";
  const viaLink = await post(linkJar, "/api/auth/otp/verify", { token });
  check("following it signs in", viaLink.body?.data?.user?.role === "ADMIN", viaLink.body);
  check("and it records itself as a link login",
    (await db.auditLog.findFirst({ where: { action: "LOGIN_VIA_LINK" }, orderBy: { createdAt: "desc" } })) !== null);

  console.log("── a link is single use, and a fresh code kills the old one");
  const replay = await post(jar(), "/api/auth/otp/verify", { token });
  check("replaying the same link is refused", replay.body?.ok === false, replay.body);
  const first = await post(jar(), "/api/auth/otp/request", { email: "bank@afa.local" });
  await new Promise((r) => setTimeout(r, 61_000));
  const second = await post(jar(), "/api/auth/otp/request", { email: "bank@afa.local" });
  const stale = await post(jar(), "/api/auth/otp/verify", { email: "bank@afa.local", code: first.body?.data?.devCode });
  check("the superseded code no longer opens anything", stale.body?.ok === false, stale.body?.error);
  const live = await post(jar(), "/api/auth/otp/verify", { email: "bank@afa.local", code: second.body?.data?.devCode });
  check("the newest one does", live.body?.ok === true, live.body?.error);

  console.log("── the system panel is only for the system administrator");
  const sys = jar();
  await signIn(sys, "system@afa.local");
  const adminJar = jar();
  await signIn(adminJar, "admin@afa.local");
  check("an organisation operator is refused the user list", (await call(adminJar, "/api/system/users")).status === 403);
  check("and the logs", (await call(adminJar, "/api/system/logs")).status === 403);
  check("and the allowlist", (await call(adminJar, "/api/system/access")).status === 403);
  const users = await call(sys, "/api/system/users");
  check("the system administrator sees every account", (users.body?.data?.list?.length ?? 0) > 0, users.body?.error);
  check("staff included", users.body?.data?.list?.some((u: any) => u.role === "BANK"), users.body?.data?.list?.map((u: any) => u.role).slice(0, 6));

  console.log("── banning an account stops it, sessions and all");
  const victim = jar();
  const victimEmail = `victim.${Date.now()}@afa.local`;
  await signIn(victim, victimEmail);
  check("the victim is in", (await call(victim, "/api/auth/me")).body?.data?.user !== null);
  const row = await db.user.findUnique({ where: { email: victimEmail } });
  const banned = await patch(sys, "/api/system/users", { uid: row!.uid, action: "disable", reason: "آزمون" });
  check("disabled", banned.body?.data?.user?.disabled === true, banned.body);
  check("their live session is cut", (await call(victim, "/api/auth/me")).body?.data?.user === null);
  const retry = await post(jar(), "/api/auth/otp/request", { email: victimEmail });
  check("and they cannot ask for a new code", retry.status === 403, retry.status);

  const restored = await patch(sys, "/api/system/users", { uid: row!.uid, action: "enable" });
  check("re-enabling works", restored.body?.data?.user?.disabled === false, restored.body);

  console.log("── a system administrator cannot lock themselves out");
  const self = await patch(sys, "/api/system/users", { uid: "SYS-001", action: "disable" });
  check("disabling your own account is refused", self.status === 400, self.body?.error);

  console.log("── registration is open, and the allowlist is ready for when it is not");
  const access = await call(sys, "/api/system/access");
  check("it reports itself open", access.body?.data?.restricted === false, access.body?.data);
  const added = await post(sys, "/api/system/access", { action: "add", email: "partner@afa.local", note: "نمونه" });
  check("an address can be listed while it is still open", added.status === 201, added.body);
  const openStill = await post(jar(), "/api/auth/otp/request", { email: `anyone.${Date.now()}@afa.local` });
  check("and anyone may still register", openStill.body?.ok === true, openStill.body?.error);

  await post(sys, "/api/system/access", { action: "setRestricted", restricted: true });
  const blocked = await post(jar(), "/api/auth/otp/request", { email: `stranger.${Date.now()}@afa.local` });
  check("once restricted, a stranger is turned away", blocked.status === 403, blocked.status);
  const allowed = await post(jar(), "/api/auth/otp/request", { email: "partner@afa.local" });
  check("but a listed address is not", allowed.body?.ok === true, allowed.body?.error);
  await post(sys, "/api/system/access", { action: "setRestricted", restricted: false });
  await post(sys, "/api/system/access", { action: "remove", email: "partner@afa.local" });

  console.log("── everything above left a trail");
  const logs = await call(sys, "/api/system/logs");
  const kinds = new Set((logs.body?.data?.list ?? []).map((l: any) => l.action));
  for (const k of ["LOGIN_SUCCEEDED", "LOGIN_VIA_LINK", "REGISTERED", "USER_DISABLED", "USER_ENABLED", "ALLOWLIST_ADDED", "REGISTRATION_POLICY_CHANGED"]) {
    check(`  ${k} is in the log`, kinds.has(k), [...kinds].slice(0, 12));
  }
  check("flow events are merged in too", (logs.body?.data?.list ?? []).some((l: any) => l.source === "FLOW"));
}

run(main);
