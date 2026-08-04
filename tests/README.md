# Tests

End-to-end, against a real system. Nothing here is mocked: the suites drive the
same HTTP routes the panels drive, against a real Postgres and a real EVM, and
read the results back out of the database and off the chain.

That is deliberate. The things most worth checking — who may move a status, how
much the contract actually pays out, whether the books describe what happened to
the money — are exactly the things a mock would decide for us. A suite that
passes here is a claim about the system, not about a fixture.

## Running them

```bash
npm test                 # everything whose world is up
npm test -- import       # only suites whose file or title matches
npm test -- --list       # what there is
```

Each suite is also a program:

```bash
npx tsx --conditions=react-server tests/import-flow.test.ts
```

## What has to be running

`npm test` checks all four before it starts and says plainly what is missing
rather than letting a suite fail with a connection error.

| | |
|---|---|
| **db** | Postgres, migrated and seeded — `npm run db:migrate && npm run db:seed` |
| **server** | the app — `npm run dev` |
| **chain** | a local node — `npx hardhat node` then `npm run chain:local` |
| **browser** | playwright and a chromium binary (`CHROMIUM_PATH` to move it) |

A suite whose world is missing is **skipped and reported**, never quietly
dropped. A run where nothing could run at all exits non-zero.

`npm run chain:local` deploys a token and the settlement factory onto the local
node and writes both addresses into `.env`. It is needed after every restart of
the node, because a hardhat node keeps nothing — and it refuses to run against
any chain but the local one, since rewriting those addresses moves every deposit
address the app would quote.

### Two settings worth getting right first

- **`EMAIL_PROVIDER=console`.** A full run signs in dozens of times and every
  sign-in is an email. Against a real provider that is money spent and a sending
  domain's reputation risked on addresses nobody reads. The code comes back in
  the response either way.
- **`AUTH_RATE_LIMIT`** high enough for a run. The ceiling is per caller per ten
  minutes and it is aimed at someone walking a list of ten thousand addresses,
  not at a suite signing in as five roles. `signIn` waits the cooldown out
  rather than weakening it, so a low value costs minutes, not correctness.

## Layout

- `harness.ts` — the API client, sign-in, chain helpers, and the check counter.
  Everything a suite would otherwise copy.
- `browser.ts` — playwright helpers: open a page as a role, check for sideways
  scroll, collect anything that reached the console.
- `run.ts` — preflight, one child process per suite, and the totals.
- `*.test.ts` — the suites, ordered in `run.ts` so the contract goes first: if
  the thing that decides where money goes is wrong, nothing after it means
  anything.

Suites share one database and run in sequence, so they see each other's data on
purpose — a list screen with only one invoice on it proves less than one with
this run's invoice among the rest. What they must not share is a process: the
counters are module-scoped and several suites move global settings around, so
each gets its own.

## Writing one

```ts
import { check, jar, post, run, signIn, STAFF, step } from "./harness";

async function main() {
  const admin = jar();
  await signIn(admin, STAFF.admin);

  step("what is being done");
  const res = await post(admin, "/api/…", { … });
  check("what should be true of it", res.body?.ok === true, res.body?.error);
}

run(main);
```

`run` prints the totals whatever happens, so a suite that throws half way still
reports the checks it managed. `check`'s third argument is only printed on
failure — put whatever you would want to see in it.

Then add the file to `SUITES` in `run.ts` with what it needs.

A check earns its place by being able to fail. Where a suite exists because of a
specific bug, it is worth confirming the check goes red against the old
behaviour before trusting the green.
