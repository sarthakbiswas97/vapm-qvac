/**
 * Dune SIM Integration -- Real-time wallet data from Dune's API.
 *
 * Uses Dune SIM for:
 * 1. Wallet balance tracking (replaces raw RPC calls)
 * 2. Transaction history for portfolio analysis
 * 3. Token metadata enrichment
 *
 * SIM provides pre-enriched data within 200ms of block propagation
 * across 60+ chains including Solana.
 */

const SIM_BASE_URL = "https://api.sim.dune.com/v1";

/**
 * Create a Dune SIM client.
 * @param {string} apiKey - SIM API key from sim.dune.com dashboard
 */
export function createSimClient(apiKey) {
  const headers = {
    "X-Sim-Api-Key": apiKey,
    "Content-Type": "application/json",
  };

  /**
   * Get wallet balances across all tokens.
   * @param {string} address - Wallet address
   * @param {string} chain - "solana" or EVM chain name
   */
  async function getBalances(address, chain = "solana") {
    const url = `${SIM_BASE_URL}/${chain}/balances/${address}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`SIM balances error: ${res.status}`);
    return res.json();
  }

  /**
   * Get transaction history for a wallet.
   * @param {string} address - Wallet address
   * @param {string} chain - "solana" or EVM chain name
   */
  async function getTransactions(address, chain = "solana") {
    const url = `${SIM_BASE_URL}/${chain}/transactions/${address}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`SIM transactions error: ${res.status}`);
    return res.json();
  }

  /**
   * Get token metadata.
   * @param {string} tokenAddress - Token mint address
   * @param {string} chain - "solana" or EVM chain name
   */
  async function getTokenMetadata(tokenAddress, chain = "solana") {
    const url = `${SIM_BASE_URL}/${chain}/tokens/${tokenAddress}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`SIM token error: ${res.status}`);
    return res.json();
  }

  return { getBalances, getTransactions, getTokenMetadata };
}

// CLI test mode
if (process.argv[1]?.endsWith("dune-sim.js")) {
  const apiKey = process.env.DUNE_SIM_API_KEY;
  if (!apiKey) {
    console.log("Set DUNE_SIM_API_KEY to test. Get one at https://sim.dune.com/");
    process.exit(1);
  }

  const client = createSimClient(apiKey);
  const testAddress = process.argv[2] || "Av6hZgtFh4rCJm5Xd62LvfmfA14LMwfKe3NvTv6FgYqo";

  console.log(`=== Dune SIM Test: ${testAddress} ===\n`);

  try {
    console.log("[Balances]");
    const balances = await client.getBalances(testAddress);
    console.log(JSON.stringify(balances, null, 2).slice(0, 500));
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  try {
    console.log("\n[Transactions]");
    const txs = await client.getTransactions(testAddress);
    console.log(JSON.stringify(txs, null, 2).slice(0, 500));
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  console.log("\n=== Done ===");
}
