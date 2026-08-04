import "dotenv/config";
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainProfile } from "../lib/chains";

/**
 * Deploys a stand-in for USDT on a test network.
 *
 * A test chain has no USDT. Without a token there is nothing for the settlement
 * contract to split, so a rehearsal on Sepolia needs one that behaves the way
 * the real thing does where it matters: it emits `Transfer`, which is the only
 * thing the deposit watcher ever looks at.
 *
 * It mints on demand and to anyone. That is the point — it is play money, and
 * saying so plainly is better than a token that looks real in a screenshot.
 *
 *   DEPLOY_PRIVATE_KEY=0x… npm run contracts:token
 *
 * The key pays for gas and becomes nobody: the token has no owner and no
 * privileged function. It never enters the application's environment.
 */
const TOKEN_SOURCE = (decimals: number) => `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// A deliberately minimal ERC-20 for testing the AFA gateway. Not for value.
contract AfaTestUSDT {
    string public constant name = "AFA Test USDT";
    string public constant symbol = "USDT";
    uint8  public constant decimals = ${decimals};
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// Anyone may mint. It is test money and pretending otherwise helps nobody.
    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
        totalSupply += value;
        emit Transfer(address(0), to, value);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "allowance");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        require(balanceOf[from] >= value, "balance");
        unchecked { balanceOf[from] -= value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}`;

const need = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

async function main() {
  const chainId = Number(need("CHAIN_ID"));
  const rpc = need("CHAIN_RPC_URL");
  const decimals = Number(process.env.USDT_DECIMALS ?? 6);
  const profile = chainProfile(chainId);

  if (!profile.testnet) {
    throw new Error(
      `CHAIN_ID ${chainId} is not a test network. This deploys play money that anyone can ` +
        `mint — on a real chain it would be a token pretending to be USDT.`,
    );
  }

  const chain = defineChain({
    id: chainId,
    name: profile.name,
    nativeCurrency: { name: profile.nativeSymbol, symbol: profile.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });

  const account = privateKeyToAccount(need("DEPLOY_PRIVATE_KEY") as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`chain    : ${profile.name} (${chainId})`);
  console.log(`deployer : ${account.address}  (${formatEther(balance)} ${profile.nativeSymbol})`);
  console.log(`decimals : ${decimals}\n`);
  if (balance === 0n) {
    throw new Error(`the deployer has no ${profile.nativeSymbol} to pay for gas`);
  }

  const solc = (await import("solc")).default;
  const out = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "AfaTestUSDT.sol": { content: TOKEN_SOURCE(decimals) } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  const errors = (out.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e: { formattedMessage: string }) => e.formattedMessage).join("\n"));
  const artifact = out.contracts["AfaTestUSDT.sol"].AfaTestUSDT;

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}` as `0x${string}`,
    args: [],
  });
  console.log(`deploying: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("deployment failed");
  const token = receipt.contractAddress.toLowerCase();

  // Seeds the bank so there is something to fund an import with on day one.
  const treasury = process.env.BANK_TREASURY_WALLET;
  if (treasury) {
    const mint = await wallet.writeContract({
      address: token as `0x${string}`,
      abi: artifact.abi,
      functionName: "mint",
      args: [treasury as `0x${string}`, parseUnits("1000000", decimals)],
    });
    await publicClient.waitForTransactionReceipt({ hash: mint });
    console.log(`minted   : 1,000,000 to the bank treasury (${treasury})`);
  }

  console.log(`\ntoken    : ${token}`);
  if (profile.explorer) console.log(`explorer : ${profile.explorer}/address/${token}`);
  console.log(`\nPut this in .env, then deploy the factory against it:\n`);
  console.log(`  USDT_CONTRACT_ADDRESS=${token}`);
  console.log(`  USDT_DECIMALS=${decimals}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
