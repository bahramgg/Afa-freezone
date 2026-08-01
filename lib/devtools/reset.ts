"use client";

const STORE_KEYS = [
  "afa-demo:auth",
  "afa-demo:invoices",
  "afa-demo:send",
  "afa-demo:settlements",
  "afa-demo:wallets",
  "afa-demo:notifications",
  "afa-demo:transactions",
];

export function resetDemo() {
  if (typeof window === "undefined") return;
  STORE_KEYS.forEach((k) => window.localStorage.removeItem(k));
  window.location.href = "/";
}

if (typeof window !== "undefined") {
  (window as unknown as { __afaReset?: () => void }).__afaReset = resetDemo;
}
