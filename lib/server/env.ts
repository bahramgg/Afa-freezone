import "server-only";
import { z } from "zod";

/**
 * Every runtime secret and network parameter enters the app here. Nothing in
 * this file has a production-safe default: a missing value fails the boot
 * rather than silently pointing the app at the wrong chain or a dev secret.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** 32+ byte secret used to sign session and CSRF tokens. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(72),

  /** BSC Testnet is 97, mainnet is 56. */
  CHAIN_ID: z.coerce.number().int().positive().default(97),
  CHAIN_RPC_URL: z.string().url().default("https://bsc-testnet.drpc.org"),
  CHAIN_EXPLORER_URL: z.string().url().default("https://testnet.bscscan.com"),
  /** BEP-20 USDT contract on the configured chain. */
  USDT_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default("0x337610d27c682e347c9cd60bd4b3b107c9d34ddd"),
  USDT_DECIMALS: z.coerce.number().int().min(0).max(36).default(18),
  /** Confirmations before a deposit counts as final. */
  CHAIN_MIN_CONFIRMATIONS: z.coerce.number().int().positive().default(15),
  /** Blocks per watcher pass; keep under the RPC provider's log range limit. */
  CHAIN_SCAN_BATCH: z.coerce.number().int().positive().default(500),
  /** Shared secret required by the watcher's cron endpoint. */
  CHAIN_WATCHER_TOKEN: z.string().min(16).optional(),

  SMS_PROVIDER: z.enum(["console", "kavenegar", "smsir", "melipayamak"]).default("console"),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER: z.string().optional(),
  SMS_TEMPLATE: z.string().optional(),

  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(3),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
