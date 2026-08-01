"use client";

import { broadcast, subscribeBroadcast } from "./_broadcast";

/**
 * With a real server, the other tabs no longer need the state — they need to
 * know it changed. Each store broadcasts a bare "reload" ping and every other
 * tab refetches, so nobody renders a copy that the server has already moved on
 * from.
 */
export function pingReload(slice: string) {
  broadcast(slice, { reload: true });
}

export function onReload(slice: string, reload: () => void) {
  if (typeof window === "undefined") return () => {};
  return subscribeBroadcast(slice, (payload) => {
    if ((payload as { reload?: boolean })?.reload) void reload();
  });
}
