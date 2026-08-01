import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

/**
 * Mints the key material the deposit addresses are derived from.
 *
 * Run this on the operator's own machine. The mnemonic is the only thing that
 * can move the funds that arrive, so it belongs in their wallet and nowhere
 * else — not in .env, not in the repository, not in a chat window. Only the
 * xpub goes into the gateway, which is enough to derive every deposit address
 * and not enough to spend from any of them.
 *
 *   npm run gen:xpub
 */
const PATH = process.env.GATEWAY_DERIVATION_PATH ?? "m/44'/60'/0'/0";

const mnemonic = generateMnemonic(wordlist, 256);
const root = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
const account = root.derive(PATH);

console.log(`
┌──────────────────────────────────────────────────────────────────────────┐
│  SECRET — import this into the operator's wallet, then close this window  │
└──────────────────────────────────────────────────────────────────────────┘

${mnemonic}

  Derivation path : ${PATH}
  First address   : the same one your wallet shows at index 0

┌──────────────────────────────────────────────────────────────────────────┐
│  PUBLIC — this line goes in .env                                          │
└──────────────────────────────────────────────────────────────────────────┘

GATEWAY_XPUB=${account.publicExtendedKey}
GATEWAY_DERIVATION_PATH=${PATH}

The gateway derives every deposit address from that xpub. It cannot spend from
any of them — sweeping the funds is done with the wallet holding the mnemonic,
outside this system, exactly like every other transfer here.
`);
