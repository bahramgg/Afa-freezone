"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { encodeFunctionData, parseAbi, parseUnits } from "viem";
import { CheckCircle2, Clock, ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { CopyButton } from "@/components/shared/CopyButton";

/**
 * The page a foreign buyer lands on.
 *
 * This is the whole point of calling ourselves a gateway: the buyer follows one
 * link, sees exactly what to pay and where, and pays without an account, a
 * login, or anyone telling them to copy a hash into an email. Their wallet
 * builds the transfer against the address this invoice — and only this invoice
 * — is quoted at, so the payment identifies itself.
 *
 * Everything shown here comes from the public invoice endpoint, which refuses
 * to say anything about an invoice that is not payable.
 */

const ERC20 = parseAbi(["function transfer(address to, uint256 value) returns (bool)"]);

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type ChainInfo = {
  id: number;
  explorerUrl: string;
  token: { address: string; decimals: number; symbol: string };
};

type CheckoutInvoice = {
  id: string;
  trxId: string;
  amount: number;
  receivedAmount?: number;
  currency: string;
  goodsTitle: string;
  description: string;
  senderName: string;
  userName?: string;
  status: string;
  paymentAddress: string;
  expiresAt?: string;
  txHash?: string;
};

function injected(): EthereumProvider | null {
  const p = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  return p && typeof p.request === "function" ? p : null;
}

function useCountdown(iso?: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  if (left == null) return null;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Checkout({
  reference,
  initial,
}: {
  reference: string;
  initial: { invoice: CheckoutInvoice; chain: ChainInfo };
}) {
  // The server already read the invoice, so the page arrives complete and this
  // component only has to keep it fresh.
  const [invoice, setInvoice] = useState<CheckoutInvoice>(initial.invoice);
  const chain = initial.chain;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hash, setHash] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/invoices/${reference}`, { cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (body?.ok) setInvoice(body.data.invoice);
  }, [reference]);

  // While a payment is outstanding the page watches for it, so a buyer paying
  // from a phone or an exchange sees it land without refreshing.
  const outstandingNow = invoice.status === "APPROVED" || invoice.status === "PAYMENT_PENDING";
  useEffect(() => {
    if (!outstandingNow) return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [outstandingNow, load]);

  const remaining = useCountdown(invoice.expiresAt);

  const paid = invoice.status === "PAID";
  const expired = invoice.status === "EXPIRED";
  const payable = invoice.status === "APPROVED" || invoice.status === "PAYMENT_PENDING";
  const outstanding = Math.max(0, invoice.amount - (invoice.receivedAmount ?? 0));

  async function payWithWallet() {
    const provider = injected();
    if (!provider) {
      setNotice("No wallet was found in this browser. Send the transfer manually instead.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await provider.request({ method: "eth_requestAccounts" });

      const current = (await provider.request({ method: "eth_chainId" })) as string;
      if (parseInt(current, 16) !== chain.id) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chain.id.toString(16)}` }],
        });
      }

      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const from = accounts?.[0];
      if (!from) throw new Error("No account is connected.");

      const value = parseUnits(String(outstanding), chain.token.decimals);
      const sent = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from,
            to: chain.token.address,
            data: encodeFunctionData({
              abi: ERC20,
              functionName: "transfer",
              args: [invoice.paymentAddress as `0x${string}`, value],
            }),
          },
        ],
      })) as string;

      setHash(sent);
      setNotice("Transfer sent. This page will confirm it as soon as the network does.");
      // Hand the hash over so the payment settles even if log scanning is down.
      await submitHash(sent);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The wallet rejected the request.";
      setNotice(message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  }

  async function submitHash(value: string) {
    const txHash = value.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      setNotice("That does not look like a transaction hash.");
      return;
    }
    setBusy(true);
    try {
      if (invoice.status === "APPROVED") {
        await fetch(`/api/invoices/${reference}/transition`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "startPayment" }),
        });
      }
      const res = await fetch(`/api/invoices/${reference}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirmPayment", txHash }),
      });
      const body = await res.json();
      if (!body?.ok) {
        setNotice(body?.error?.message ?? "The network has not confirmed that transfer yet.");
      } else {
        setNotice(null);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment request</p>
          <h1 className="text-lg font-semibold">{invoice.goodsTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.userName ? `from ${invoice.userName}` : null}
            {invoice.userName ? " · " : null}
            <span className="font-mono">{invoice.trxId}</span>
          </p>
        </header>

        {paid ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/5 py-8 text-center">
            <CheckCircle2 className="h-9 w-9 text-success" />
            <p className="font-medium">Payment received</p>
            {invoice.txHash ? (
              <a
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                href={`${chain.explorerUrl.replace(/\/$/, "")}/tx/${invoice.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View on the explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : expired ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 py-8 text-center">
            <Clock className="h-9 w-9 text-muted-foreground" />
            <p className="font-medium">This payment request has expired</p>
            <p className="text-xs text-muted-foreground">Ask the seller to issue a new one.</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Amount due</span>
                <span className="font-mono text-xl font-semibold">
                  {outstanding} {chain.token.symbol}
                </span>
              </div>
              {invoice.receivedAmount ? (
                <p className="text-xs text-warning">
                  {invoice.receivedAmount} of {invoice.amount} {chain.token.symbol} received so
                  far — send the remainder to the same address.
                </p>
              ) : null}
              {remaining ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Expires in {remaining}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4">
              <div className="rounded-md bg-white p-3">
                <QRCodeSVG
                  value={`ethereum:${chain.token.address}@${chain.id}/transfer?address=${invoice.paymentAddress}&uint256=${parseUnits(String(outstanding), chain.token.decimals)}`}
                  size={148}
                />
              </div>
              <div className="w-full space-y-1.5">
                <Label>Send {chain.token.symbol} on BNB Smart Chain to</Label>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                    {invoice.paymentAddress}
                  </code>
                  <CopyButton value={invoice.paymentAddress} />
                </div>
                <p className="text-xs text-muted-foreground">
                  This address belongs to this request alone. Sending any other token, or sending
                  on another network, will not be credited.
                </p>
              </div>
            </div>

            {payable ? (
              <Button className="w-full" onClick={payWithWallet} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Pay with a browser wallet
              </Button>
            ) : null}

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm">
                Already sent it from elsewhere?
              </summary>
              <div className="mt-3 space-y-2">
                <Label htmlFor="hash">Transaction hash</Label>
                <div className="flex gap-2">
                  <Input
                    id="hash"
                    value={hash}
                    onChange={(e) => setHash(e.target.value)}
                    placeholder="0x…"
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" onClick={() => submitHash(hash)} disabled={busy}>
                    Check
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payments are picked up automatically; this only speeds it up.
                </p>
              </div>
            </details>
          </>
        )}

        {notice ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{notice}</p>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Payment is verified on chain by the gateway before the seller is credited.
        </p>
      </div>
    </Shell>
  );
}

/** The checkout is read left-to-right: its audience is the foreign buyer. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="ltr" className="min-h-screen bg-muted/30 px-4 py-8 text-start">
      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardContent className="p-5">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
