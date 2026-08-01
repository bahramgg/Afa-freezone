import "server-only";
import { HDKey } from "@scure/bip32";
import { secp256k1 } from "@noble/curves/secp256k1";
import { getAddress, keccak256, toHex } from "viem";
import { env } from "../env";

/**
 * Deposit addresses, one per payment.
 *
 * A gateway that quotes one shared address for every invoice cannot tell whose
 * money arrived: it has to guess from the amount, and guesses wrongly the
 * moment two open invoices sit on the same address. Deriving an address per
 * payment makes the match exact — whatever lands there belongs to that invoice
 * and nothing else.
 *
 * The system holds only the extended PUBLIC key. That is enough to derive every
 * receive address and not enough to spend a single rial of what arrives: the
 * seed stays with the bank operator, who sweeps the funds with their own wallet
 * and reports the hash, exactly as they do everywhere else in this system.
 */

let cached: HDKey | null = null;

function node(): HDKey {
  if (cached) return cached;

  const xpub = env().GATEWAY_XPUB;
  if (!xpub) {
    throw new Error(
      "GATEWAY_XPUB is not set — run `npm run gen:xpub` and put the printed xpub in .env",
    );
  }
  const key = HDKey.fromExtendedKey(xpub);

  // Guarding against the operator pasting an xprv by mistake: that would put a
  // spending key in the database's reach, which is the one thing this design
  // exists to avoid.
  if (key.privateKey !== null) {
    throw new Error(
      "GATEWAY_XPUB carries a private key — use the extended PUBLIC key (xpub…), never the xprv",
    );
  }

  cached = key;
  return key;
}

/**
 * The address at a BIP-44 index under the configured account node.
 *
 * BIP32 hands back a compressed public key; an EVM address is the last twenty
 * bytes of the keccak hash of the uncompressed one, minus its 0x04 prefix.
 */
export function deriveDepositAddress(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff) {
    throw new Error(`Not a usable derivation index: ${index}`);
  }

  const child = node().deriveChild(index);
  if (!child.publicKey) throw new Error(`Could not derive a public key at index ${index}`);

  const point = secp256k1.ProjectivePoint.fromHex(child.publicKey);
  const uncompressed = point.toRawBytes(false).slice(1);
  return getAddress(`0x${keccak256(toHex(uncompressed)).slice(-40)}`).toLowerCase();
}

/** True when a gateway xpub is configured at all. */
export function hasGatewayXpub(): boolean {
  return Boolean(env().GATEWAY_XPUB);
}
