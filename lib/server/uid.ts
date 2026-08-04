import "server-only";
import { db } from "./db";
import type { Role } from "@/lib/generated/prisma/client";

const PREFIX: Record<Role, string> = {
  IRANIAN: "IR",
  FOREIGN: "FOR",
  ADMIN: "ADM",
  BANK: "BNK",
  SUPERADMIN: "SYS",
};

/**
 * Allocates the next display uid for a role (IR-001, FOR-042, ...). Backed by a
 * Postgres sequence so concurrent sign-ups cannot collide on the same number.
 *
 * The sequence is not the only thing that ever wrote a uid, though: the seed
 * names its three operator accounts ADM-001, BNK-001 and SYS-001 outright,
 * without asking. A fresh sequence therefore hands out a number that is already
 * on an account, and the insert fails on a unique constraint — which only shows
 * up the first time a second operator of that kind is created, long after the
 * seed ran. So the number is checked before it is handed back, and a taken one
 * is skipped rather than returned to fail downstream.
 */
export async function nextUid(role: Role): Promise<string> {
  const seq = `afa_uid_${role.toLowerCase()}_seq`;
  await db.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seq}" START WITH 1`);

  // Bounded: each pass consumes a number, so this cannot spin. Generous enough
  // that it only gives up if something is very wrong with the sequence itself.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const rows = await db.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('"${seq}"') AS nextval`,
    );
    const uid = `${PREFIX[role]}-${String(Number(rows[0]!.nextval)).padStart(3, "0")}`;
    const taken = await db.user.findUnique({ where: { uid }, select: { id: true } });
    if (!taken) return uid;
  }

  throw new Error(`could not allocate a ${role} uid — "${seq}" is behind the accounts it names`);
}
