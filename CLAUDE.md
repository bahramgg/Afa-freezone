@AGENTS.md

# AFA — Agent Guide

Currency payment gateway for **منطقه آزاد**. Real backend, real database,
real chain reads. Read `README.md` first for setup and the security model.

## Shape of the codebase

```
app/
  page.tsx           landing page (public)
  (user)/            Iranian merchant panel
  foreign/           foreign merchant panel
  admin/             free-zone admin panel
  bank/              settlement bank panel
  api/               route handlers — the whole server
lib/
  server/            server-only: db, env, auth, http, chain, serializers
  stores/            Zustand stores; thin caches over the API
  api/client.ts      fetch wrapper, {ok, data|error} envelope
  generated/prisma/  generated client — do not edit, do not commit
prisma/
  schema.prisma      domain model
  seed.ts            bootstrap accounts + bank wallets
```

## Rules

- **Persian fa-IR + RTL** for every user-facing string. Code and comments in
  English. Latin identifiers (addresses, hashes) go in `<Ltr>`, never
  `dir="ltr"` on a table cell — that breaks column alignment.
- **Dates:** ISO in state and the database, Jalali at render via
  `formatJalali` / `<JalaliDate>`. Both emit Persian digits.
- **Money:** `Decimal` in the database, `formatToken` / `<MoneyText>` at render.
  Never format an amount by hand.
- **Server files** import `server-only` and live under `lib/server/`. Nothing
  there may be imported from a client component.
- **Every state transition** goes through the flow's `/transition` route, which
  checks the caller's role *and* the record's current status, and appends a
  `StatusEvent`. Do not mutate a status anywhere else.
- **Never trust a client-supplied amount, recipient or tx hash.** Chain facts
  come from `verifyTransfer`, which reads the receipt from the node.
- **Query scope comes from the session**, never from a client filter parameter.
- **No private keys.** Signing happens outside the system; the operator submits
  a hash and the chain is the proof.
- **Path alias:** `@/*` from the repo root.

## Working on the UI

- shadcn-style primitives in `components/ui/`, feature components beside their
  domain (`components/invoice/`, `components/bank/`, …).
- Tables live inside `overflow-x-auto` and carry a `min-w-*` so columns keep
  their width and the container scrolls on narrow screens.
- `Card` is `min-w-0` so a card holding a wide table can shrink inside a grid.
- Stores start empty; `DataBootstrap` in each layout loads what that persona
  needs. A new store needs a loader added there, not a fetch in the page.

## Before declaring a task done

- [ ] `npx tsc --noEmit` is clean.
- [ ] `npm run build` succeeds.
- [ ] If routes or flows changed, walk them in a browser — not just unit-level.
- [ ] No page-level horizontal scroll at 390px.

## Heads-up about the versions

Next.js 16 + React 19 + Tailwind v4 + Prisma 7. Several APIs differ from older
training data — notably Prisma 7 moved the datasource URL into
`prisma.config.ts` and requires a driver adapter. When in doubt, consult
`node_modules/<pkg>/` over recall.
