"use client";

const CHANNEL = "afa-demo";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL);
    } catch {
      channel = null;
    }
  }
  return channel;
}

const senderId = typeof window !== "undefined" ? Math.random().toString(36).slice(2) : "ssr";

export function broadcast(slice: string, payload: unknown) {
  const ch = getChannel();
  if (!ch) return;
  ch.postMessage({ slice, payload, sender: senderId });
}

export function subscribeBroadcast(
  slice: string,
  handler: (payload: unknown) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMessage = (ev: MessageEvent) => {
    const data = ev.data as { slice: string; payload: unknown; sender: string };
    if (!data || data.slice !== slice || data.sender === senderId) return;
    handler(data.payload);
  };
  ch.addEventListener("message", onMessage);
  return () => ch.removeEventListener("message", onMessage);
}
