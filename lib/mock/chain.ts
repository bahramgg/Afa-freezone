export const GATEWAY_ADDRESSES = [
  "0x3a9f7b2c4d8e1a5f9c2b8d4e7a1f3c5b9d2e6a8f",
  "0x7b4e2a9f3c1d5e8b2f6a9d4c7e1b3f5a8d2c4e9b",
  "0xa1b2c3d4e5f6789012345678901234567890abcd",
];

export const SAMPLE_TX_HASHES = [
  "0x9f3c5b8d2e6a1f4c7b9d2e5a8f3c6b1d4e7a9c2f5b8d3e6a1c4f7b9d2e5a8f3c",
  "0x4a7d1e3c9b5f2a8d6e1c4f7b9d3a5c8e2b6f1d4a7c9e3b5f8d2a6c1e4b7f9d3a",
  "0x2c5e8b1d4f7a3c6e9b2d5f8a1c4e7b3d6a9c2f5e8b1d4f7a3c6e9b2d5f8a1c4e",
  "0x8d1c4e7b3f6a9c2e5d8b1f4a7c3e6b9d2f5a8c1e4b7d3f6a9c2e5d8b1f4a7c3e",
  "0x6b9d2f5a8c1e4b7d3f6a9c2e5d8b1f4a7c3e6b9d2f5a8c1e4b7d3f6a9c2e5d8b",
  "0x1b5e9d2c4f7a3c6e9b2d5f8a1c4e7b3d6a9c2f5e8b1d4f7a3c6e9b2d5f8a1c4f",
  "0x5e9b1d2c4f7a3c6e9b2d5f8a1c4e7b3d6a9c2f5e8b1d4f7a3c6e9b2d5f8a1c52",
];

export const COUNTERPARTY_ADDRESSES = [
  "0xc7e1b3f5a8d2c4e9b6f1a4d7c2e5b8f3a6d9c1e4",
  "0x1f4a7c3e6b9d2f5a8c1e4b7d3f6a9c2e5d8b1f4a",
  "0x8b1d4f7a3c6e9b2d5f8a1c4e7b3d6a9c2f5e8b1d",
];

export const BANK_WALLET_ADDRESSES = [
  "0x3a9f0bc4d8e1a5f9c2b8d4e7a1f3c5b9d2e6a800",
  "0x7b4e2a9f3c1d5e8b2f6a9d4c7e1b3f5a8d2c4e01",
  "0x2c8d5e9b1f4a7c3e6b9d2f5a8c1e4b7d3f6a9c02",
  "0x9f1a4b3c7d6e5f8b2a3c4d5e6f7a8b9c0d1e2f03",
];

export const FOREIGN_USER_WALLETS = [
  "0x4d7c3f2ae8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
  "0x8e1b5c4df9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4",
  "0x2a5d8b1c4f7a3c6e9b2d5f8a1c4e7b3d6a9c2f50",
];

let addrIdx = 0;
let txIdx = 0;

export function nextGatewayAddress(): string {
  const a = GATEWAY_ADDRESSES[addrIdx % GATEWAY_ADDRESSES.length];
  addrIdx++;
  return a;
}

export function nextTxHash(): string {
  const h = SAMPLE_TX_HASHES[txIdx % SAMPLE_TX_HASHES.length];
  txIdx++;
  return h;
}

export function randomCounterpartyAddress(): string {
  return COUNTERPARTY_ADDRESSES[Math.floor(Math.random() * COUNTERPARTY_ADDRESSES.length)];
}

export function randomBankWallet(): string {
  return BANK_WALLET_ADDRESSES[Math.floor(Math.random() * BANK_WALLET_ADDRESSES.length)];
}
