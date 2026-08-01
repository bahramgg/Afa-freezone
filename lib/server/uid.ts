import "server-only";
import { db } from "./db";
import type { Role } from "@/lib/generated/prisma/client";

const PREFIX: Record<Role, string> = {
  IRANIAN: "IR",
  FOREIGN: "FOR",
  ADMIN: "ADM",
  BANK: "BNK",
};

/**
 * Allocates the next display uid for a role (IR-001, FOR-042, ...). Backed by a
 * Postgres sequence so concurrent sign-ups cannot collide on the same number.
 */
export async function nextUid(role: Role): Promise<string> {
  const seq = `afa_uid_${role.toLowerCase()}_seq`;
  await db.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seq}" START WITH 1`);
  const rows = await db.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${seq}"') AS nextval`,
  );
  return `${PREFIX[role]}-${String(Number(rows[0]!.nextval)).padStart(3, "0")}`;
}
