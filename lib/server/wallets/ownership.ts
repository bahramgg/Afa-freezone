import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "../db";
import { env } from "../env";
import { badRequest, conflict } from "../http";
import { normalizeAddress, publicClient } from "../chain/client";

/**
 * Wallet ownership proof.
 *
 * The gateway never holds a private key, so the only thing that can establish
 * that a user controls an address is a signature they produce themselves. The
 * server picks the nonce, so a signature harvested from anywhere else — another
 * site, an old session, a different account — will not verify here.
 */

const CHALLENGE_TTL_MINUTES = 10;

/** How long a nonce stays redeemable, in milliseconds. */
const TTL_MS = CHALLENGE_TTL_MINUTES * 60_000;

/**
 * The exact text the wallet is asked to sign.
 *
 * It is deliberately plain English: this string is rendered by MetaMask and
 * friends, whose signature popups are laid out left-to-right and have no
 * bidirectional handling worth relying on. The Persian explanation belongs in
 * our own UI, next to the button. Every field the verification depends on is
 * present in the text, so what the user reads is what the server checks.
 */
export function challengeMessage(input: {
  address: string;
  uid: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    "AFA — Free Zone Currency Gateway",
    "Wallet ownership verification",
    "",
    `Address: ${input.address}`,
    `Account: ${input.uid}`,
    `Chain ID: ${env().CHAIN_ID}`,
    `Nonce: ${input.nonce}`,
    `Issued at: ${input.issuedAt.toISOString()}`,
    `Expires at: ${input.expiresAt.toISOString()}`,
    "",
    "Signing this message proves you control this wallet.",
    "It authorises no transaction and spends no funds.",
  ].join("\n");
}

export type IssuedChallenge = {
  address: string;
  message: string;
  expiresAt: Date;
};

/**
 * Issues a nonce for an address. Any earlier unconsumed nonce for the same
 * address and account is retired, so exactly one challenge is ever live and a
 * user who reloads the dialog cannot accidentally sign a stale one.
 */
export async function issueWalletChallenge(
  user: { id: string; uid: string },
  addressInput: string,
): Promise<IssuedChallenge> {
  const address = normalizeAddress(addressInput);

  // The same address in two accounts would make "verified" meaningless — the
  // proof would say who holds the key, but not which account it belongs to.
  const claimedElsewhere = await db.wallet.findFirst({
    where: { address, ownerKind: "USER", verified: true, userId: { not: user.id } },
    select: { id: true },
  });
  if (claimedElsewhere) {
    throw conflict("این آدرس قبلاً به حساب دیگری تأیید شده است");
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + TTL_MS);
  const nonce = randomBytes(16).toString("hex");

  await db.$transaction([
    db.walletChallenge.updateMany({
      where: { userId: user.id, address, consumedAt: null },
      data: { consumedAt: issuedAt },
    }),
    db.walletChallenge.create({
      data: { userId: user.id, address, nonce, expiresAt, createdAt: issuedAt },
    }),
  ]);

  return {
    address,
    message: challengeMessage({ address, uid: user.uid, nonce, issuedAt, expiresAt }),
    expiresAt,
  };
}

/**
 * Checks a signature against the live challenge and returns the message that
 * was proven. Throws with a Persian reason on every failure path.
 *
 * Verification goes through the public client rather than plain address
 * recovery so that smart-contract wallets — Safe and similar, which cannot
 * produce an ECDSA signature at all — are accepted via ERC-1271.
 */
export async function verifyWalletChallenge(
  user: { id: string; uid: string },
  addressInput: string,
  signature: string,
): Promise<{ address: string; signature: `0x${string}` }> {
  const address = normalizeAddress(addressInput);

  const sig = signature.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(sig)) throw badRequest("امضا معتبر نیست");

  const challenge = await db.walletChallenge.findFirst({
    where: { userId: user.id, address, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) throw badRequest("درخواست امضایی برای این آدرس ثبت نشده — دوباره شروع کنید");
  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw badRequest("مهلت امضا به پایان رسیده — دوباره شروع کنید");
  }

  const message = challengeMessage({
    address,
    uid: user.uid,
    nonce: challenge.nonce,
    issuedAt: challenge.createdAt,
    expiresAt: challenge.expiresAt,
  });

  let valid: boolean;
  try {
    valid = await publicClient().verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: sig as `0x${string}`,
    });
  } catch {
    // A malformed signature makes viem throw rather than return false.
    valid = false;
  }

  // The nonce is spent either way: a wrong signature must not leave the
  // challenge open for an attacker to keep guessing against.
  await db.walletChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  if (!valid) throw badRequest("امضا با این آدرس نمی‌خواند");

  return { address, signature: sig as `0x${string}` };
}
