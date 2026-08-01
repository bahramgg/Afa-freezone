"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, PenLine, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { CopyButton } from "@/components/shared/CopyButton";
import { api, ApiClientError } from "@/lib/api/client";
import type { Wallet } from "@/lib/types";

/**
 * Adding a wallet in two steps: the server issues a nonce, the holder signs it
 * with the wallet itself, and only a signature that recovers to the address
 * marks it verified. Nothing here ever touches a private key — the signing
 * happens in the user's own wallet, and only the resulting signature is sent.
 */

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function injectedProvider(): EthereumProvider | null {
  const injected = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  return injected && typeof injected.request === "function" ? injected : null;
}

const STRINGS = {
  fa: {
    trigger: "افزودن والت",
    title: "افزودن والت با اثبات مالکیت",
    describeStart: "آدرس را وارد کنید تا متنی برای امضا ساخته شود.",
    describeSign:
      "این متن را با همان والت امضا کنید و امضا را اینجا بگذارید. امضا کردن هیچ تراکنشی انجام نمی‌دهد و کارمزدی ندارد.",
    labelName: "نام والت (اختیاری)",
    labelNamePlaceholder: "والت اصلی",
    labelAddress: "آدرس BSC",
    labelMessage: "متنی که باید امضا شود",
    labelSignature: "امضا",
    signaturePlaceholder: "0x…",
    cancel: "انصراف",
    back: "بازگشت",
    next: "ساخت متن امضا",
    signWithWallet: "امضا با کیف پول مرورگر",
    submit: "ثبت اثبات مالکیت",
    badAddress: "آدرس BSC معتبر نیست",
    needSignature: "امضا را وارد کنید",
    done: "مالکیت والت تأیید شد",
    noProvider: "کیف پولی در مرورگر پیدا نشد — متن را دستی امضا کنید",
    wrongAccount: "حساب فعال کیف پول با این آدرس یکی نیست",
    signFailed: "امضا انجام نشد",
  },
  en: {
    trigger: "Add wallet",
    title: "Add a wallet with proof of ownership",
    describeStart: "Enter the address and we will generate a message to sign.",
    describeSign:
      "Sign this message with the same wallet and paste the signature below. Signing makes no transaction and costs no gas.",
    labelName: "Wallet name (optional)",
    labelNamePlaceholder: "Main wallet",
    labelAddress: "BSC address",
    labelMessage: "Message to sign",
    labelSignature: "Signature",
    signaturePlaceholder: "0x…",
    cancel: "Cancel",
    back: "Back",
    next: "Generate message",
    signWithWallet: "Sign with browser wallet",
    submit: "Submit proof",
    badAddress: "Not a valid BSC address",
    needSignature: "Paste the signature",
    done: "Wallet ownership verified",
    noProvider: "No browser wallet found — sign the message manually",
    wrongAccount: "The wallet's active account is not this address",
    signFailed: "Signing failed",
  },
} as const;

type Props = {
  lang?: "fa" | "en";
  onVerified: (wallet: Wallet) => void;
};

export function WalletOwnershipDialog({ lang = "fa", onVerified }: Props) {
  const t = STRINGS[lang];
  const dir = lang === "en" ? "ltr" : undefined;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"address" | "sign">("address");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep("address");
    setLabel("");
    setAddress("");
    setMessage("");
    setSignature("");
  }

  function fail(error: unknown, fallback: string) {
    toast.error(error instanceof ApiClientError ? error.message : fallback);
  }

  async function requestChallenge() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      toast.error(t.badAddress);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ message: string; address: string }>("/wallets/challenge", {
        address: address.trim(),
      });
      setAddress(res.address);
      setMessage(res.message);
      setStep("sign");
    } catch (error) {
      fail(error, t.badAddress);
    } finally {
      setBusy(false);
    }
  }

  /** Signs through an injected wallet when there is one; otherwise the user pastes. */
  async function signInBrowser() {
    const provider = injectedProvider();
    if (!provider) {
      toast.error(t.noProvider);
      return;
    }
    setBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const active = accounts?.[0]?.toLowerCase();
      if (active !== address.toLowerCase()) {
        toast.error(t.wrongAccount);
        return;
      }
      const signed = (await provider.request({
        method: "personal_sign",
        params: [message, active],
      })) as string;
      setSignature(signed);
    } catch {
      toast.error(t.signFailed);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!signature.trim()) {
      toast.error(t.needSignature);
      return;
    }
    setBusy(true);
    try {
      const { wallet } = await api.post<{ wallet: Wallet }>("/wallets/verify", {
        address,
        label: label.trim() || undefined,
        signature: signature.trim(),
      });
      onVerified(wallet);
      toast.success(t.done);
      setOpen(false);
      reset();
    } catch (error) {
      fail(error, t.signFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {t.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription dir={dir} className={dir ? "text-start" : undefined}>
            {step === "address" ? t.describeStart : t.describeSign}
          </DialogDescription>
        </DialogHeader>

        {step === "address" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wallet-label">{t.labelName}</Label>
              <Input
                id="wallet-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t.labelNamePlaceholder}
                dir={dir}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-address">{t.labelAddress}</Label>
              <Input
                id="wallet-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x…"
                dir="ltr"
                className="font-mono"
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.labelMessage}</Label>
                <CopyButton value={message} />
              </div>
              <pre
                dir="ltr"
                className="max-h-44 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-start font-mono text-[11px] leading-5 whitespace-pre-wrap break-all"
              >
                {message}
              </pre>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-signature">{t.labelSignature}</Label>
              <Input
                id="wallet-signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={t.signaturePlaceholder}
                dir="ltr"
                className="font-mono"
                autoComplete="off"
              />
            </div>
            <Button variant="outline" className="w-full" onClick={signInBrowser} disabled={busy}>
              <PenLine className="h-4 w-4" />
              {t.signWithWallet}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => (step === "sign" ? setStep("address") : setOpen(false))}
            disabled={busy}
          >
            {step === "sign" ? t.back : t.cancel}
          </Button>
          <Button onClick={step === "address" ? requestChallenge : submit} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {step === "address" ? t.next : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
