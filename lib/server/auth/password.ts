import "server-only";
import { argon2id, hash, verify, type HashOptions } from "argon2";

/**
 * Argon2id with parameters sized for a request-path verify (~50-80ms on a
 * modern server core). Raise memoryCost, not iterations, if hardware improves.
 */
const OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456, // 19 MiB — OWASP's minimum recommendation
  timeCost: 2,
  parallelism: 1,
};

export function hashSecret(plain: string): Promise<string> {
  return hash(plain, { ...OPTIONS, raw: false });
}

export async function verifySecret(digest: string | null | undefined, plain: string) {
  if (!digest) {
    // Spend comparable time on unknown accounts so timing doesn't reveal them.
    await hash(plain, { ...OPTIONS, raw: false });
    return false;
  }
  try {
    return await verify(digest, plain);
  } catch {
    return false;
  }
}
