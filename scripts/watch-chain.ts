import "dotenv/config";

/**
 * Standalone deposit watcher.
 *
 * BSC produces a block roughly every half second, and RPC plans cap how wide an
 * `eth_getLogs` range may be, so polling cannot keep pace with the head. When
 * CHAIN_WSS_URL is set this subscribes to `Transfer` logs instead and reacts as
 * they arrive; the periodic sweep still runs underneath to close gaps left by a
 * dropped socket and to promote deposits once their block finalises.
 *
 * Run it as a long-lived process next to the app:
 *   npm run watch:chain
 */
async function main() {
  // Imported after dotenv so the modules see a populated environment.
  const { runWatcher } = await import("../lib/server/chain/watcher");
  const { env } = await import("../lib/server/env");
  const { usdtAddress } = await import("../lib/server/chain/client");
  const { db } = await import("../lib/server/db");

  /**
   * Addresses a deposit can legitimately land on. Invoices are always quoted a
   * bank receive wallet, so this set is small and changes only when an operator
   * adds or retires a wallet.
   */
  async function gatewayAddresses(): Promise<string[]> {
    const wallets = await db.wallet.findMany({
      where: { ownerKind: "BANK", active: true, bankKind: { in: ["RECEIVE", "SHARED"] } },
      select: { address: true },
    });
    return wallets.map((w) => w.address);
  }

  const config = env();
  const SWEEP_MS = 20_000;

  let sweeping = false;
  async function sweep(reason: string) {
    if (sweeping) return;
    sweeping = true;
    try {
      const report = await runWatcher();
      const moved =
        report.depositsRecorded || report.invoicesPaid || report.confirmationsUpdated;
      if (moved || report.scanSkipped) {
        console.log(
          `[sweep:${reason}] blocks ${report.fromBlock}-${report.toBlock} · ` +
            `deposits ${report.depositsRecorded} · paid ${report.invoicesPaid} · ` +
            `confirmations ${report.confirmationsUpdated}` +
            (report.scanSkipped ? ` · SCAN SKIPPED: ${report.scanError}` : ""),
        );
      }
    } catch (error) {
      console.error(`[sweep:${reason}] failed:`, error instanceof Error ? error.message : error);
    } finally {
      sweeping = false;
    }
  }

  console.log(`watcher starting · chain ${config.CHAIN_ID} · token ${usdtAddress()}`);
  await sweep("startup");
  const timer = setInterval(() => void sweep("interval"), SWEEP_MS);

  if (!config.CHAIN_WSS_URL) {
    console.log(`no CHAIN_WSS_URL — polling every ${SWEEP_MS / 1000}s`);
  } else {
    const recipients = await gatewayAddresses();
    if (recipients.length === 0) {
      console.warn("no active bank receive wallet — nothing to subscribe to");
    } else {
      console.log(`subscribing for ${recipients.length} gateway address(es)`);
      await subscribe(config.CHAIN_WSS_URL, usdtAddress(), recipients, () => void sweep("log"));
    }
  }

  const shutdown = async () => {
    clearInterval(timer);
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Left-pads an address into the 32-byte form an indexed topic uses. */
function toTopic(address: string) {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

/**
 * Subscribes to token transfers addressed to the gateway and calls `onLog` when
 * one arrives. The recipient filter is applied by the node — without it every
 * USDT movement on the chain would wake this process thousands of times a
 * minute. Reconnects with backoff, because a socket that silently dies would
 * stop deposits being noticed without any error surfacing.
 */
async function subscribe(
  url: string,
  token: string,
  recipients: string[],
  onLog: () => void,
) {
  const { WebSocket } = await import("ws");
  let attempt = 0;

  const connect = () => {
    const ws = new WebSocket(url);

    ws.on("open", () => {
      attempt = 0;
      console.log("websocket connected — subscribing to transfers");
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_subscribe",
          params: [
            "logs",
            { address: token, topics: [TRANSFER_TOPIC, null, recipients.map(toTopic)] },
          ],
        }),
      );
    });

    ws.on("message", (raw: Buffer | string) => {
      let message: { id?: number; method?: string; result?: unknown; error?: unknown };
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message.id === 1) {
        if (message.error) console.error("subscribe failed:", JSON.stringify(message.error));
        return;
      }
      // The sweep does the matching; the socket only says "something moved".
      // That keeps one code path responsible for writes.
      if (message.method === "eth_subscription") onLog();
    });

    ws.on("error", (error: Error) => console.error("websocket error:", error.message));

    ws.on("close", () => {
      const delay = Math.min(30_000, 1000 * 2 ** attempt++);
      console.warn(`websocket closed — reconnecting in ${delay / 1000}s`);
      setTimeout(connect, delay);
    });
  };

  connect();
}

main().catch((error) => {
  console.error("watcher failed to start:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
