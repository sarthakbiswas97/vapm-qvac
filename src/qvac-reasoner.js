/**
 * QVAC Trade Reasoner -- Local AI inference for trade decisions.
 *
 * Uses QVAC SDK to run a local LLM (Llama 3.2 1B) for:
 * 1. Explaining WHY the XGBoost model wants to trade (natural language)
 * 2. Analyzing market conditions from feature data
 * 3. Generating risk assessment narratives
 *
 * Everything runs LOCALLY -- no cloud, no API keys, no data leakage.
 * This is "sovereign AI" for trading: your strategy never leaves your device.
 */

import { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } from "@qvac/sdk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { searchContext } from "./qvac-rag.js";

let modelId = null;
let loadingPercent = null;

// Check for locally downloaded model first (faster than P2P registry)
const LOCAL_MODEL_PATH = join(homedir(), ".qvac", "models", "Llama-3.2-1B-Instruct-Q4_0.gguf");

/**
 * Initialize the local LLM model.
 * Tries local file first, falls back to QVAC registry download.
 */
export async function initQVAC() {
  if (modelId) return modelId;

  const useLocal = existsSync(LOCAL_MODEL_PATH);
  const modelSrc = useLocal ? `file://${LOCAL_MODEL_PATH}` : LLAMA_3_2_1B_INST_Q4_0;

  console.log(`[QVAC] Loading Llama 3.2 1B ${useLocal ? "from local file" : "from registry (downloads ~700MB)"}...`);
  loadingPercent = 0;

  modelId = await loadModel({
    modelSrc,
    modelType: "llamacpp-completion",
    onProgress: (progress) => {
      if (progress.percent != null) {
        loadingPercent = progress.percent;
      }
      if (progress.percent && progress.percent % 20 === 0) {
        console.log(`[QVAC] Loading: ${progress.percent}%`);
      }
    },
  });

  loadingPercent = null;
  console.log("[QVAC] Model loaded. All inference runs locally.");
  return modelId;
}

/**
 * Generate a trade reasoning explanation from ML prediction data.
 * Runs entirely on-device via QVAC -- no cloud API calls.
 *
 * @param {Object} prediction - ML model output
 * @param {string} prediction.direction - "UP" or "DOWN"
 * @param {number} prediction.confidence - 0.0 to 1.0
 * @param {Object} prediction.shap - SHAP feature importances
 * @param {Object} prediction.features - Current feature values
 * @param {Object} riskState - Current risk metrics
 * @returns {string} Natural language trade reasoning
 */
export async function generateTradeReasoning(prediction, riskState, ragContext = null) {
  if (!modelId) await initQVAC();

  const topFeatures = Object.entries(prediction.shap || {})
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([name, value]) => `${name}: ${value > 0 ? "+" : ""}${value.toFixed(4)} (pushes ${value > 0 ? "UP" : "DOWN"})`)
    .join("\n");

  // Build RAG context: use provided context or fetch dynamically
  let retrievedContext = ragContext;
  if (!retrievedContext) {
    try {
      const topFeatureNames = Object.entries(prediction.shap || {})
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 2)
        .map(([name]) => name)
        .join(" and ");
      const query = `${prediction.direction} signal with ${topFeatureNames} drivers for SOL/USDC trading`;
      retrievedContext = await searchContext(query);
    } catch (err) {
      console.log(`[QVAC RAG] Context retrieval failed: ${err.message}`);
      retrievedContext = "";
    }
  }

  const ragSection = retrievedContext
    ? `\nRelevant knowledge:\n${retrievedContext}\n`
    : "";

  const prompt = `You are a quantitative trading analyst. Explain this AI trading signal concisely in 3-4 sentences.
${ragSection}
Signal: ${prediction.direction} with ${(prediction.confidence * 100).toFixed(1)}% confidence
Top SHAP feature drivers:
${topFeatures}

Current risk state:
- Daily PnL: ${(riskState.dailyPnlPct * 100).toFixed(2)}%
- Drawdown: ${(riskState.drawdownPct * 100).toFixed(2)}%
- Position exposure: ${(riskState.exposurePct * 100).toFixed(2)}%

Explain why the model recommends ${prediction.direction} and whether the risk state supports this trade.`;

  const history = [{ role: "user", content: prompt }];

  let reasoning = "";
  const result = completion({ modelId, history, stream: true });

  for await (const token of result.tokenStream) {
    reasoning += token;
  }

  return reasoning.trim();
}

/**
 * Analyze market conditions and generate a summary.
 * Uses QVAC local LLM -- no data sent to any server.
 *
 * @param {Object} features - Technical indicator values
 * @returns {string} Market analysis
 */
export async function analyzeMarket(features) {
  if (!modelId) await initQVAC();

  const prompt = `You are a technical analyst. Give a brief 2-3 sentence market assessment based on these indicators:

RSI: ${features.rsi?.toFixed(1) || "N/A"}
MACD: ${features.macd?.toFixed(4) || "N/A"}
MACD Signal: ${features.macd_signal?.toFixed(4) || "N/A"}
Bollinger Position: ${features.bollinger_position?.toFixed(2) || "N/A"}
Volatility: ${features.volatility?.toFixed(4) || "N/A"}
Volume Spike: ${features.volume_spike?.toFixed(2) || "N/A"}
Momentum: ${features.momentum?.toFixed(4) || "N/A"}

Is this a good time to trade? What's the dominant signal?`;

  const history = [{ role: "user", content: prompt }];

  let analysis = "";
  const result = completion({ modelId, history, stream: true });

  for await (const token of result.tokenStream) {
    analysis += token;
  }

  return analysis.trim();
}

/**
 * Generate a risk assessment before trade execution.
 *
 * @param {Object} tradeParams - Proposed trade parameters
 * @param {Object} riskLimits - Configured risk limits
 * @returns {Object} { approved: boolean, reasoning: string }
 */
export async function assessRisk(tradeParams, riskLimits) {
  if (!modelId) await initQVAC();

  const prompt = `You are a risk manager. Should this trade be approved? Answer YES or NO, then explain in 2 sentences.

Proposed trade:
- Direction: ${tradeParams.direction}
- Position size: ${tradeParams.positionBps} basis points
- Confidence: ${(tradeParams.confidence * 100).toFixed(1)}%

Risk limits:
- Max position: ${riskLimits.maxPositionBps} bps
- Max daily loss: ${riskLimits.maxDailyLossBps} bps
- Max drawdown: ${riskLimits.maxDrawdownBps} bps

Current state:
- Daily PnL: ${tradeParams.dailyPnlBps} bps
- Drawdown: ${tradeParams.drawdownBps} bps

Does this trade violate any limits? Is the confidence level sufficient?`;

  const history = [{ role: "user", content: prompt }];

  let response = "";
  const result = completion({ modelId, history, stream: true });

  for await (const token of result.tokenStream) {
    response += token;
  }

  const approved = response.toUpperCase().startsWith("YES");

  return { approved, reasoning: response.trim() };
}

/**
 * Get the current model loading progress.
 * @returns {number | null} 0-100 during loading, null when not loading
 */
export function getLoadingProgress() {
  return loadingPercent;
}

/**
 * Clean up and unload the model.
 */
export async function shutdown() {
  if (modelId) {
    await unloadModel({ modelId });
    modelId = null;
    console.log("[QVAC] Model unloaded.");
  }
}

// CLI test mode
if (process.argv[1]?.endsWith("qvac-reasoner.js")) {
  console.log("=== QVAC Trade Reasoner Test ===\n");

  await initQVAC();

  const testPrediction = {
    direction: "UP",
    confidence: 0.72,
    shap: { rsi: -0.12, macd: 0.25, volatility: -0.08, momentum: 0.15, bollinger_position: 0.10 },
  };

  const testRisk = { dailyPnlPct: -0.01, drawdownPct: 0.02, exposurePct: 0.0 };

  console.log("[Test] Generating trade reasoning...\n");
  const reasoning = await generateTradeReasoning(testPrediction, testRisk);
  console.log("Trade Reasoning:");
  console.log(reasoning);

  console.log("\n[Test] Analyzing market...\n");
  const analysis = await analyzeMarket({ rsi: 35, macd: 0.002, macd_signal: -0.001, bollinger_position: -0.3, volatility: 0.02, volume_spike: 1.5, momentum: 0.003 });
  console.log("Market Analysis:");
  console.log(analysis);

  console.log("\n[Test] Assessing risk...\n");
  const risk = await assessRisk(
    { direction: "UP", positionBps: 300, confidence: 0.72, dailyPnlBps: 50, drawdownBps: 100 },
    { maxPositionBps: 500, maxDailyLossBps: 300, maxDrawdownBps: 1000 }
  );
  console.log(`Risk Assessment: ${risk.approved ? "APPROVED" : "REJECTED"}`);
  console.log(risk.reasoning);

  await shutdown();
  console.log("\n=== Test Complete ===");
}
