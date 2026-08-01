/**
 * Only used to run a local chain for contract tests. The contract itself is
 * compiled by scripts/compile-contracts.ts, whose settings are what the
 * deployed bytecode — and therefore every deposit address — is derived from.
 */
module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: { chainId: 31337 },
  },
};
