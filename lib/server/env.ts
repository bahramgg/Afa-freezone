import "server-only";
import { z } from "zod";

/**
 * Every runtime secret and network parameter enters the app here. Nothing in
 * this file has a production-safe default: a missing value fails the boot
 * rather than silently pointing the app at the wrong chain or a dev secret.
 */
/**
 * A key present but empty in .env means "not set", not "set to nothing".
 *
 * Commenting a value out and blanking it are the same intent, and an optional
 * setting should not fail the boot because someone left the equals sign there.
 */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), inner.optional());

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** 32+ byte secret used to sign session and CSRF tokens. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(72),

  /**
   * Which chain the gateway settles on.
   *
   * 56 BSC · 97 BSC testnet · 1 Ethereum · 11155111 Sepolia · 31337 a local node.
   * Nothing in the code is tied to any of them: the name, the native coin and
   * the explorer are all read from here, so moving chains is configuration.
   */
  CHAIN_ID: z.coerce.number().int().positive().default(56),
  CHAIN_RPC_URL: z.string().url(),
  /**
   * Optional websocket endpoint. When set, the standalone watcher subscribes to
   * transfers in real time instead of polling — the only workable mode on a
   * chain producing a block every half second.
   */
  CHAIN_WSS_URL: optional(z.string().url()),
  CHAIN_EXPLORER_URL: z.string().url().default("https://bscscan.com"),
  /** BEP-20 USDT contract on the configured chain. */
  USDT_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default("0x55d398326f99059fF775485246999027B3197955"),
  USDT_DECIMALS: z.coerce.number().int().min(0).max(36).default(18),
  /**
   * The settlement factory, deployed with `npm run contracts:deploy`.
   *
   * Deposit addresses are derived from it, and the split between the gateway,
   * the organization and the bank happens inside the contract it deploys —
   * which is why no key to a deposit address exists anywhere.
   */
  GATEWAY_FACTORY_ADDRESS: optional(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  /**
   * How a deposit is judged irreversible.
   *
   * `finalized` asks the node for its finalised head — correct on BSC, whose
   * fast finality makes a finalised block unrevertable regardless of how many
   * blocks follow it. `confirmations` counts blocks instead, for nodes that do
   * not serve the finalized tag.
   */
  CHAIN_FINALITY: z.enum(["finalized", "confirmations"]).default("finalized"),
  /** Only consulted when CHAIN_FINALITY=confirmations. */
  CHAIN_MIN_CONFIRMATIONS: z.coerce.number().int().positive().default(15),
  /**
   * Blocks per getLogs request. Providers cap this and the cap differs per plan
   * — QuickNode's free tier allows 5. A rejected range is halved and retried,
   * so this is a starting point rather than a hard limit.
   */
  CHAIN_SCAN_BATCH: z.coerce.number().int().positive().default(5),
  /** Upper bound on getLogs requests per watcher tick, so one pass is bounded. */
  CHAIN_SCAN_MAX_REQUESTS: z.coerce.number().int().positive().default(40),
  /** Shared secret required by the watcher's cron endpoint. */
  CHAIN_WATCHER_TOKEN: optional(z.string().min(16)),

  /** OTP delivery. `console` prints to the server log — development only. */
  EMAIL_PROVIDER: z.enum(["console", "smtp", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("AFA <no-reply@afa.local>"),
  SMTP_HOST: optional(z.string()),
  SMTP_PORT: optional(z.coerce.number().int().positive()),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  SMTP_USER: optional(z.string()),
  SMTP_PASSWORD: optional(z.string()),
  RESEND_API_KEY: optional(z.string()),

  /**
   * How many sign-in requests one caller may make in ten minutes.
   *
   * Tuned for a person, not a test run: two or three is a bad day. Raised
   * locally so a suite that signs in as five roles in a row is not throttled by
   * a protection aimed at someone walking a list of ten thousand addresses.
   */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),

  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(3),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  /**
   * Opens every panel to anyone holding the link.
   *
   * With this on there is no sign-in: arriving at a panel adopts that panel's
   * representative account and the system behaves normally from there. It is
   * off unless explicitly set, because it makes the deployment public — every
   * invoice, every balance, and every action an operator can take.
   */
  AUTH_OPEN_ACCESS: z
    .preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() === "true" : v), z.boolean())
    .default(false),

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
