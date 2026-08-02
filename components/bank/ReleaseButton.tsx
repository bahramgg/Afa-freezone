"use client";

import { useState } from "react";
import { toast } from "sonner";
import { encodeFunctionData } from "viem";
import { Loader2, Split } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api/client";
import factoryArtifact from "@/contracts/artifacts/afa-gateway.json";

/**
 * Releases a deposit: one transaction, three destinations.
 *
 * The operator signs it with their own wallet, so nothing in this system holds
 * a key — and nothing needs to, because the destinations are fixed by the
 * deposit address itself. The worst an operator could do with this button is
 * pay the correct people at the wrong moment.
 */

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function injected(): EthereumProvider | null {
  const p = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  return p && typeof p.request === "function" ? p : null;
}

export function ReleaseButton({
  depositId,
  factory,
  terms,
  chainId,
  direction,
  onReleased,
}: {
  depositId: string;
  factory?: string;
  terms?: unknown;
  chainId: number;
  direction?: "EXPORT" | "IMPORT";
  onReleased: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // Exporting, the remainder is the bank's; importing, it is the seller's.
  const beneficiaryLabel = direction === "IMPORT" ? "فروشنده" : "بانک";

  async function release() {
    const provider = injected();
    if (!provider) {
      toast.error("کیف پولی در مرورگر پیدا نشد — برای تسویه به کیف پول نیاز است");
      return;
    }
    if (!factory || !terms) {
      toast.error("قرارداد تسویه پیکربندی نشده است");
      return;
    }

    setBusy(true);
    try {
      await provider.request({ method: "eth_requestAccounts" });
      const current = (await provider.request({ method: "eth_chainId" })) as string;
      if (parseInt(current, 16) !== chainId) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      }
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const from = accounts?.[0];
      if (!from) throw new Error("هیچ حسابی متصل نیست");

      // The stored terms go back to the contract unchanged — they are what the
      // address was derived from, so any edit would simply miss the money.
      const t = terms as Record<string, string | number>;
      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: factory,
            data: encodeFunctionData({
              abi: factoryArtifact.AfaGatewayFactory.abi,
              functionName: "release",
              args: [
                {
                  invoiceRef: String(t.invoiceRef),
                  feeBps: Number(t.feeBps),
                  freezoneBps: Number(t.freezoneBps),
                  feeMin: BigInt(t.feeMin),
                  feeMax: BigInt(t.feeMax),
                  token: t.token,
                  gatewayWallet: t.gatewayWallet,
                  freezoneWallet: t.freezoneWallet,
                  beneficiary: t.beneficiary,
                },
              ],
            }),
          },
        ],
      })) as string;

      toast.info("تراکنش ارسال شد — منتظر تأیید شبکه");

      // The server reads the contract's own event back, so what lands in the
      // books is what the contract paid rather than what we expected.
      let recorded = false;
      for (let attempt = 0; attempt < 20 && !recorded; attempt++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const result = await api.post<{
            split: { gateway: string; freezone: string; beneficiary: string };
          }>("/deposits", { id: depositId, txHash });
          recorded = true;
          toast.success(
            `تسویه شد — درگاه ${result.split.gateway} · سازمان ${result.split.freezone} · ${beneficiaryLabel} ${result.split.beneficiary}`,
          );
        } catch (error) {
          const message = error instanceof ApiClientError ? error.message : "";
          // Still waiting for the chain; anything else is a real failure.
          if (!message.includes("پیدا نشد")) throw error;
        }
      }
      if (!recorded) {
        toast.error("تراکنش هنوز تأیید نشده — بعداً دوباره ثبتش کنید");
      }
      await onReleased();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.split("\n")[0] : "تسویه انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={release} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Split className="h-3.5 w-3.5" />}
      تسویه و تقسیم
    </Button>
  );
}
