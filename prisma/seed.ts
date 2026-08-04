import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hash, argon2id } from "argon2";

/**
 * Bootstraps the accounts and infrastructure the system cannot start without:
 * one admin, one bank operator, and the bank's receive/send wallets.
 *
 * Idempotent — safe to run against an existing database. Staff passwords come
 * from the environment; there is no hard-coded default, so a forgotten seed
 * cannot leave a known-password admin account exposed.
 */
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function hashSecret(plain: string) {
  return hash(plain, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}


/**
 * Staff sign in by emailed code like everyone else, so a staff address that
 * cannot receive mail is a locked panel rather than a placeholder.
 *
 * The .local defaults are fine on a laptop, where the code comes back in the
 * response. In production they silently create three accounts nobody can ever
 * open — the free zone, the bank and the system administrator all shut out —
 * and the failure only shows up when someone tries to sign in.
 */
function staffEmail(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback;
  const undeliverable = /\.(local|test|invalid|example)$/i.test(value.split("@")[1] ?? "");
  if (undeliverable && process.env.NODE_ENV === "production") {
    throw new Error(
      `${name} is "${value}", which cannot receive email. Sign-in is by emailed code, ` +
        `so this account would be unreachable. Set ${name} to a real address.`,
    );
  }
  return value;
}

async function main() {
  const adminEmail = staffEmail("SEED_ADMIN_EMAIL", "admin@afa.local");
  const bankEmail = staffEmail("SEED_BANK_EMAIL", "bank@afa.local");
  const systemEmail = staffEmail("SEED_SYSTEM_EMAIL", "system@afa.local");

  await db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log("· settings row ready");

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: {
      uid: "ADM-001",
      role: "ADMIN",
      fullName: process.env.SEED_ADMIN_NAME ?? "ادمین سیستم",
      email: adminEmail,
      kyc: "APPROVED",
      avatarColor: "oklch(0.62 0.16 240)",
    },
    update: {},
  });
  console.log(`· admin ${admin.uid} <${admin.email}>`);

  const bank = await db.user.upsert({
    where: { email: bankEmail },
    create: {
      uid: "BNK-001",
      role: "BANK",
      fullName: process.env.SEED_BANK_NAME ?? "مدیر عملیات ارزی",
      email: bankEmail,
      kyc: "APPROVED",
      avatarColor: "oklch(0.65 0.18 155)",
    },
    update: {},
  });
  console.log(`· bank operator ${bank.uid} <${bank.email}>`);

  // Runs the system rather than the business: users, logs, who may register.
  const system = await db.user.upsert({
    where: { email: systemEmail },
    create: {
      uid: "SYS-001",
      role: "SUPERADMIN",
      fullName: process.env.SEED_SYSTEM_NAME ?? "مدیر سیستم",
      email: systemEmail,
      kyc: "APPROVED",
      avatarColor: "oklch(0.6 0.2 300)",
    },
    update: { role: "SUPERADMIN" },
  });
  console.log(`· system administrator ${system.uid} <${system.email}>`);

  // A staff role is only valid while its address is on the access list, so
  // three operator accounts without three list entries are three locked panels.
  for (const staff of [admin, bank, system]) {
    await db.allowedEmail.upsert({
      where: { email: staff.email! },
      create: { email: staff.email!, role: staff.role, note: "حساب اولیهٔ سامانه" },
      update: { role: staff.role },
    });
  }
  console.log("· access list carries the three operator addresses");

  // Gateway wallets. Without at least one RECEIVE wallet no invoice can be
  // approved, because there is nowhere to quote for payment.
  const receive = process.env.SEED_BANK_RECEIVE_WALLET?.toLowerCase();
  const send = process.env.SEED_BANK_SEND_WALLET?.toLowerCase();

  for (const [address, bankKind, label] of [
    [receive, "RECEIVE", "کیف پول دریافت اصلی"],
    [send, "SEND", "کیف پول ارسال اصلی"],
  ] as const) {
    if (!address) {
      console.warn(
        `! skipped ${bankKind} wallet — set SEED_BANK_${bankKind}_WALLET to an EVM address`,
      );
      continue;
    }
    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      throw new Error(`SEED_BANK_${bankKind}_WALLET is not a valid EVM address: ${address}`);
    }
    const existing = await db.wallet.findFirst({ where: { address, ownerKind: "BANK" } });
    if (existing) {
      console.log(`· ${bankKind} wallet already present (${address})`);
      continue;
    }
    await db.wallet.create({
      data: { address, label, ownerKind: "BANK", bankKind, verified: true, verifiedAt: new Date() },
    });
    console.log(`· ${bankKind} wallet created (${address})`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
