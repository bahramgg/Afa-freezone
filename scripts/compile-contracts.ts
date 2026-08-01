import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import solc from "solc";

/**
 * Compiles the gateway contract and writes its ABI and bytecode where the
 * server can read them.
 *
 *   npm run contracts:build
 */
const SOURCE = "AfaGateway.sol";
const root = process.cwd();

const input = {
  language: "Solidity",
  sources: {
    [SOURCE]: { content: readFileSync(join(root, "contracts", SOURCE), "utf8") },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // A deposit address is the hash of the deployment bytecode, so the compiler
    // settings are part of what the address commits to. Any change here moves
    // every future address and must be deliberate.
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));

const fatal = (out.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
for (const e of out.errors ?? []) console.log(e.formattedMessage);
if (fatal.length) {
  console.error(`\n${fatal.length} error(s) — nothing written.`);
  process.exit(1);
}

const artifacts: Record<string, { abi: unknown; bytecode: string }> = {};
for (const [name, contract] of Object.entries(out.contracts[SOURCE] as Record<string, any>)) {
  artifacts[name] = {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

// Committed, not generated at build time: a deposit address is derived from
// this bytecode, so it must not move because someone's compiler patch version
// differs. Rebuilding is deliberate, and the diff shows every address moving.
mkdirSync(join(root, "contracts/artifacts"), { recursive: true });
writeFileSync(
  join(root, "contracts/artifacts/afa-gateway.json"),
  `${JSON.stringify(artifacts, null, 2)}\n`,
);

for (const [name, a] of Object.entries(artifacts)) {
  console.log(`${name.padEnd(20)} ${(a.bytecode.length / 2 - 1).toString().padStart(6)} bytes`);
}
console.log("\nWritten to contracts/artifacts/afa-gateway.json");
