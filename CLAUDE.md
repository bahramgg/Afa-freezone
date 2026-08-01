@AGENTS.md

# `frontend-demo/` — Local Agent Guide

> The click-through demo for **منطقه آزاد گلستان**. Mocked end-to-end. No backend, no chain, no real auth.
> The authoritative context lives in `../claude-code/` — read it first.

## Read in this order

1. `../CLAUDE.md` — workspace overview.
2. `../claude-code/README.md` — how the memory system works.
3. `../claude-code/PROJECT_OVERVIEW.md` — what this product is.
4. `../claude-code/CONVENTIONS.md` — coding rules (RTL, Persian, mock-data discipline).
5. `../claude-code/decisions/001-frontend-demo-stack.md` — why we picked the stack.
6. **`../claude-code/plans/frontend-demo.md`** — the phased build plan you'll execute.
7. **`../claude-code/progress/frontend-demo.md`** — the running log of what's been done.
8. `../docs/demo-requirements.md` — Persian product spec (the source of truth for behavior).

## Working rules in this app

- **Never** add `fetch`, `axios`, `ethers`, `viem`, `web3`, or any wallet connector. The demo is fully mocked.
- **Persian fa-IR + RTL.** All user-facing strings are Persian. Code/comments are English.
- **State:** Zustand stores in `lib/stores/` with `persist` + `BroadcastChannel('afa-demo')`.
- **Dates:** ISO in state, Jalali (شمسی) at render via `dayjs` + `jalaliday`.
- **Components:** shadcn/ui primitives in `components/ui/`, feature components elsewhere.
- **Path alias:** `@/*` from the `frontend-demo/` root.

## Before declaring a task done

- [ ] Updated `../claude-code/plans/frontend-demo.md` if scope/approach changed.
- [ ] Appended a dated entry to `../claude-code/progress/frontend-demo.md`.
- [ ] Ticked the matching checkbox in the plan.
- [ ] If a non-obvious decision was made: wrote a new ADR in `../claude-code/decisions/`.

## Heads-up about Next.js 16

This project uses Next.js 16 + React 19 + Tailwind v4. Some APIs differ from older training data — when in doubt, consult `node_modules/next/dist/docs/` over recall.
