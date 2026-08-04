/**
 * What each chain is called, and what it pays gas in.
 *
 * Deliberately not `server-only`: the panels need the explorer link and the
 * native symbol too, and a second copy of this table on the client is a second
 * place for it to go stale.
 *
 * A chain that is not listed still works — the gateway reads the chain id, the
 * RPC and the explorer from the environment and never from this table. What is
 * lost is only the name, and `CHAIN_NAME` can supply that.
 */
export type ChainProfile = {
  name: string;
  /**
   * The same name for the buyer's page, which is in English.
   *
   * A foreign buyer picks the network in their own wallet from this string. It
   * has to be the name their wallet uses, not a transliteration of ours.
   */
  enName: string;
  /** What gas is paid in. Not what the gateway settles — that is always the token. */
  nativeSymbol: string;
  explorer: string;
  /** True for a chain whose money is not real. Worth saying out loud on screen. */
  testnet: boolean;
};

export const CHAINS: Record<number, ChainProfile> = {
  1: {
    name: "اتریوم",
    enName: "Ethereum",
    nativeSymbol: "ETH",
    explorer: "https://etherscan.io",
    testnet: false,
  },
  11155111: {
    name: "اتریوم سپولیا",
    enName: "Ethereum Sepolia",
    nativeSymbol: "ETH",
    explorer: "https://sepolia.etherscan.io",
    testnet: true,
  },
  56: {
    name: "زنجیرهٔ هوشمند بایننس",
    enName: "BNB Smart Chain",
    nativeSymbol: "BNB",
    explorer: "https://bscscan.com",
    testnet: false,
  },
  97: {
    name: "بایننس تست‌نت",
    enName: "BNB Smart Chain Testnet",
    nativeSymbol: "BNB",
    explorer: "https://testnet.bscscan.com",
    testnet: true,
  },
  31337: {
    name: "زنجیرهٔ محلی",
    enName: "Local network",
    nativeSymbol: "ETH",
    explorer: "http://localhost",
    testnet: true,
  },
};

const UNKNOWN: ChainProfile = {
  name: "زنجیرهٔ پیکربندی‌شده",
  enName: "the configured network",
  nativeSymbol: "ETH",
  explorer: "",
  testnet: true,
};

export const chainProfile = (id: number): ChainProfile => CHAINS[id] ?? UNKNOWN;

/**
 * The chain the browser is looking at.
 *
 * Inlined at build time, so a deployment pointed at a different chain has to be
 * rebuilt — which is correct: the addresses baked into it belong to that chain
 * and nothing else.
 */
export const publicChainId = () => Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 56);

/** Where to look a hash or an address up. Empty when no explorer is known. */
export function explorerUrl(hashOrAddress: string, type: "tx" | "address" = "tx"): string {
  const base = (process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || chainProfile(publicChainId()).explorer)
    .replace(/\/$/, "");
  return base ? `${base}/${type}/${hashOrAddress}` : "";
}

/** What gas is paid in on the chain this build is pointed at. */
export const nativeSymbol = () => chainProfile(publicChainId()).nativeSymbol;

/**
 * How a currency should be written on screen.
 *
 * `BNB` is the enum's name for "the chain's native coin" and predates the
 * system running anywhere but BSC. Renaming it in the database would rewrite
 * settled history to say something it did not say at the time; renaming it at
 * the point of display costs nothing and stops a Sepolia deployment claiming
 * to hold BNB.
 */
export function currencyLabel(currency: string): string {
  return currency === "BNB" ? nativeSymbol() : currency;
}
