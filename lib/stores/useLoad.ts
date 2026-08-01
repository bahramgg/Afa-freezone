"use client";

import { useEffect, useRef } from "react";

/**
 * Runs a store's `load()` once per mount (and again when a dependency in `deps`
 * changes). Errors are swallowed on purpose: an unauthenticated or transient
 * failure leaves the store empty, which the guards and empty states already
 * handle, and a thrown promise here would take the page down.
 */
export function useLoad(load: () => Promise<unknown>, deps: unknown[] = []) {
  const ref = useRef(load);
  ref.current = load;

  useEffect(() => {
    void ref.current().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
