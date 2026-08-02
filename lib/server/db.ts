import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { env } from "./env";

/**
 * One client per process. Next.js hot-reloads modules in development, so the
 * instance is parked on globalThis to avoid opening a new pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function client(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Built on first use, not on import.
 *
 * `next build` imports every route module to collect its page data, so anything
 * a module does at import time has to work on a build machine. Constructing the
 * client here read DATABASE_URL through the env schema, which meant a build
 * could not run anywhere the runtime secrets were absent — and Render, like
 * most hosts, builds with a narrower environment than it runs with. The proxy
 * defers all of that to the first query, so building needs no database and no
 * secrets, while every call site keeps using `db` exactly as before.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const value = Reflect.get(client(), property, receiver);
    // Methods have to keep their own `this`, or `db.invoice` and `db.$transaction`
    // would be called against the proxy rather than the client.
    return typeof value === "function" ? value.bind(client()) : value;
  },
  set(_target, property, value) {
    return Reflect.set(client(), property, value);
  },
  has: (_target, property) => property in client(),
});
