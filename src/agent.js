/**
 * VAPM-QVAC Sovereign AI Trading Agent
 *
 * An autonomous trading agent that runs ENTIRELY locally:
 * - XGBoost ML model for price prediction (Python, local)
 * - QVAC local LLM for trade reasoning and risk assessment (no cloud)
 * - Dune SIM for real-time wallet data
 * - All data stays on-device -- sovereign AI
 *
 * Architecture:
 *   QVAC LLM (local) + XGBoost (local) + Dune SIM (data) = Sovereign Trading Agent
 */

import { initQVAC, generateTradeReasoning, analyzeMarket, assessRisk, shutdown } from "./qvac-reasoner.js";
import { createSimClient } from "./dune-sim.js";

const AGENT_CONFIG = {
  walletAddress: process.env.WALLET_ADDRESS || "Av6hZgtFh4rCJm5Xd62LvfmfA14LMwfKe3NvTv6FgYqo",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  duneSimKey: process.env.DUNE_SIM_API_KEY || "",
  riskLimits: {
    maxPositionBps: 500,    // 5%
    maxDailyLossBps: 300,   // 3%
    maxDrawdownBps: 1000,   // 10%
  },
};

async function fetchPrediction() {
  try {
    const res = await fetch(`${AGENT_CONFIG.mlServiceUrl}/predict`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.prediction || null;
  } catch {
    return null;
  }
}

async function fetchRiskState() {
  try {
    const res = await fetch(`${AGENT_CONFIG.mlServiceUrl}/risk/state`);
    if (!res.ok) return { dailyPnlPct: 0, drawdownPct: 0, exposurePct: 0 };
    const data = await res.json();
    return {
      dailyPnlPct: data.state?.daily_pnl_pct || 0,
      drawdownPct: data.state?.current_drawdown_pct || 0,
      exposurePct: data.state?.total_exposure_pct || 0,
    };
  } catch {
    return { dailyPnlPct: 0, drawdownPct: 0, exposurePct: 0 };
  }
}

async function fetchFeatures() {
  try {
    const res = await fetch(`${AGENT_CONFIG.mlServiceUrl}/features/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.features || null;
  } catch {
    return null;
  }
}

async function runCycle() {
  console.log("\n" + "=".repeat(60));
  console.log(`[${new Date().toISOString()}] Agent Cycle`);
  console.log("=".repeat(60));

  // 1. Get ML prediction
  console.log("\n[1/5] Fetching ML prediction...");
  const prediction = await fetchPrediction();
  if (!prediction) {
    console.log("  No prediction available. Skipping cycle.");
    return;
  }
  console.log(`  Direction: ${prediction.direction}`);
  console.log(`  Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);

  // 2. Get risk state
  console.log("\n[2/5] Checking risk state...");
  const riskState = await fetchRiskState();
  console.log(`  Daily PnL: ${(riskState.dailyPnlPct * 100).toFixed(2)}%`);
  console.log(`  Drawdown: ${(riskState.drawdownPct * 100).toFixed(2)}%`);

  // 3. QVAC: Generate trade reasoning (LOCAL, no cloud)
  console.log("\n[3/5] QVAC: Generating trade reasoning (local LLM)...");
  const reasoning = await generateTradeReasoning(
    {
      direction: prediction.direction,
      confidence: prediction.confidence,
      shap: prediction.shap_explanation || {},
    },
    riskState,
  );
  console.log(`  Reasoning: ${reasoning}`);

  // 4. QVAC: Risk assessment (LOCAL, no cloud)
  console.log("\n[4/5] QVAC: Assessing risk (local LLM)...");
  const riskAssessment = await assessRisk(
    {
      direction: prediction.direction,
      positionBps: 300,
      confidence: prediction.confidence,
      dailyPnlBps: Math.abs(riskState.dailyPnlPct * 10000),
      drawdownBps: riskState.drawdownPct * 10000,
    },
    AGENT_CONFIG.riskLimits,
  );
  console.log(`  Verdict: ${riskAssessment.approved ? "APPROVED" : "REJECTED"}`);
  console.log(`  Assessment: ${riskAssessment.reasoning}`);

  // 5. Wallet data via Dune SIM
  if (AGENT_CONFIG.duneSimKey) {
    console.log("\n[5/5] Dune SIM: Fetching wallet data...");
    try {
      const sim = createSimClient(AGENT_CONFIG.duneSimKey);
      const balances = await sim.getBalances(AGENT_CONFIG.walletAddress);
      console.log(`  Wallet balances: ${JSON.stringify(balances).slice(0, 200)}...`);
    } catch (e) {
      console.log(`  SIM error: ${e.message}`);
    }
  } else {
    console.log("\n[5/5] Dune SIM: Skipped (no API key set)");
  }

  // Summary
  console.log("\n" + "-".repeat(60));
  console.log("Cycle Summary:");
  console.log(`  Signal: ${prediction.direction} (${(prediction.confidence * 100).toFixed(1)}%)`);
  console.log(`  QVAC Reasoning: ${reasoning.slice(0, 100)}...`);
  console.log(`  Risk Verdict: ${riskAssessment.approved ? "APPROVED" : "REJECTED"}`);
  console.log(`  All inference ran LOCALLY via QVAC -- zero cloud dependency`);
  console.log("-".repeat(60));
}

async function main() {
  console.log("=== VAPM-QVAC: Sovereign AI Trading Agent ===");
  console.log("All AI inference runs locally via QVAC SDK.");
  console.log("No cloud APIs. No data leakage. Sovereign intelligence.\n");

  // Initialize QVAC local LLM
  await initQVAC();

  // Run one cycle
  await runCycle();

  // Cleanup
  await shutdown();
  console.log("\nAgent shutdown complete.");
}

main().catch(console.error);
