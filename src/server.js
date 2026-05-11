/**
 * QVAC Agent HTTP Server
 *
 * Exposes the local QVAC LLM inference as HTTP endpoints so the
 * frontend can trigger REAL on-device reasoning instead of faking it.
 *
 * Uses Node.js built-in http module (no Express dependency).
 * Requires Node.js >= 22.17 for @qvac/sdk compatibility.
 *
 * Endpoints:
 *   GET  /health          - Server + model status
 *   POST /api/cycle       - Run full agent cycle (predict + reason + risk + market)
 *   POST /api/reason      - Trade reasoning only
 *   POST /api/risk        - Risk assessment only
 *   POST /api/market      - Market analysis only
 *   POST /api/speak       - Text-to-speech (returns WAV audio)
 */

import { createServer } from "node:http";
import { initQVAC, generateTradeReasoning, analyzeMarket, assessRisk, shutdown, getLoadingProgress } from "./qvac-reasoner.js";
import { initRAG, searchContext, shutdownRAG, isRAGReady, getKnowledgeFileCount } from "./qvac-rag.js";
import { initTTS, speak, shutdownTTS } from "./qvac-tts.js";

const PORT = parseInt(process.env.QVAC_PORT || "8002", 10);
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001";

let modelReady = false;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function jsonResponse(res, status, body) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Invalid JSON in request body");
  }
}

async function fetchFromML(path) {
  try {
    const res = await fetch(`${ML_SERVICE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function handleCycle(req, res) {
  if (!modelReady) {
    return jsonResponse(res, 503, { error: "QVAC model still loading" });
  }

  const predData = await fetchFromML("/predict");
  const prediction = predData?.prediction || null;
  if (!prediction) {
    return jsonResponse(res, 502, { error: "ML service unavailable" });
  }

  const riskData = await fetchFromML("/risk/state");
  const riskState = {
    dailyPnlPct: riskData?.state?.daily_pnl_pct || 0,
    drawdownPct: riskData?.state?.current_drawdown_pct || 0,
    exposurePct: riskData?.state?.total_exposure_pct || 0,
  };

  const featData = await fetchFromML("/features/latest");
  const features = featData?.features || {};

  // Retrieve RAG context before LLM inference
  let ragContext = "";
  let ragEnhanced = false;
  if (isRAGReady()) {
    try {
      const topFeatureNames = Object.entries(prediction.shap_explanation || {})
        .sort((a, b) => Math.abs(b[1]?.value ?? b[1]) - Math.abs(a[1]?.value ?? a[1]))
        .slice(0, 2)
        .map(([name]) => name)
        .join(" and ");
      const query = `${prediction.direction} signal with ${topFeatureNames} drivers for SOL/USDC trading`;
      ragContext = await searchContext(query);
      ragEnhanced = !!ragContext;
    } catch (err) {
      console.error("[QVAC RAG] Context retrieval failed:", err.message);
    }
  }

  const [reasoning, riskAssessment, marketAnalysis] = await Promise.all([
    generateTradeReasoning(
      {
        direction: prediction.direction,
        confidence: prediction.confidence,
        shap: prediction.shap_explanation || {},
      },
      riskState,
      ragContext || null,
    ),
    assessRisk(
      {
        direction: prediction.direction,
        positionBps: 300,
        confidence: prediction.confidence,
        dailyPnlBps: Math.abs(riskState.dailyPnlPct * 10000),
        drawdownBps: riskState.drawdownPct * 10000,
      },
      {
        maxPositionBps: 500,
        maxDailyLossBps: 300,
        maxDrawdownBps: 1000,
      },
    ),
    analyzeMarket(features),
  ]);

  jsonResponse(res, 200, {
    prediction,
    reasoning,
    riskAssessment,
    marketAnalysis,
    ragEnhanced,
    timestamp: new Date().toISOString(),
    source: "qvac-local-llm",
  });
}

async function handleReason(req, res) {
  if (!modelReady) return jsonResponse(res, 503, { error: "Model loading" });
  const body = await readBody(req);
  const result = await generateTradeReasoning(body.prediction || {}, body.riskState || {});
  jsonResponse(res, 200, { reasoning: result });
}

async function handleRisk(req, res) {
  if (!modelReady) return jsonResponse(res, 503, { error: "Model loading" });
  const body = await readBody(req);
  const result = await assessRisk(body.tradeParams || {}, body.riskLimits || {});
  jsonResponse(res, 200, result);
}

async function handleMarket(req, res) {
  if (!modelReady) return jsonResponse(res, 503, { error: "Model loading" });
  const body = await readBody(req);
  const result = await analyzeMarket(body.features || {});
  jsonResponse(res, 200, { analysis: result });
}

async function handleSpeak(req, res) {
  const body = await readBody(req);
  const text = body.text;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return jsonResponse(res, 400, { error: "Missing or empty 'text' field" });
  }

  // Cap input length to avoid excessively long synthesis
  const trimmedText = text.slice(0, 2000);

  try {
    const wavBuffer = await speak(trimmedText);
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "audio/wav",
      "Content-Length": wavBuffer.length,
    });
    res.end(wavBuffer);
  } catch (err) {
    console.error("[QVAC TTS] Synthesis error:", err.message);
    jsonResponse(res, 500, { error: `TTS synthesis failed: ${err.message}` });
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/health" && req.method === "GET") {
      return jsonResponse(res, 200, { status: "ok", model_ready: modelReady, rag_ready: isRAGReady(), loading_percent: getLoadingProgress() });
    }
    if (url.pathname === "/api/rag-status" && req.method === "GET") {
      return jsonResponse(res, 200, {
        initialized: isRAGReady(),
        knowledgeFiles: getKnowledgeFileCount(),
      });
    }
    if (url.pathname === "/api/cycle" && req.method === "POST") {
      return await handleCycle(req, res);
    }
    if (url.pathname === "/api/reason" && req.method === "POST") {
      return await handleReason(req, res);
    }
    if (url.pathname === "/api/risk" && req.method === "POST") {
      return await handleRisk(req, res);
    }
    if (url.pathname === "/api/market" && req.method === "POST") {
      return await handleMarket(req, res);
    }
    if (url.pathname === "/api/speak" && req.method === "POST") {
      return await handleSpeak(req, res);
    }
    jsonResponse(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[QVAC Server] Error:", err.message);
    jsonResponse(res, 500, { error: err.message });
  }
});

async function start() {
  console.log("[QVAC Server] Loading Llama 3.2 1B locally via QVAC SDK...");
  await initQVAC();
  modelReady = true;
  console.log("[QVAC Server] Model ready. All inference runs on-device.");

  console.log("[QVAC Server] Initializing RAG knowledge base...");
  await initRAG();
  console.log("[QVAC Server] RAG ready. Knowledge base loaded.");

  // TTS loads lazily on first /api/speak request to avoid blocking startup.
  // Optionally pre-load by uncommenting the next two lines:
  // console.log("[QVAC Server] Pre-loading TTS model...");
  // await initTTS();

  server.listen(PORT, () => {
    console.log(`[QVAC Server] Listening on http://localhost:${PORT}`);
    console.log(`[QVAC Server] ML service expected at ${ML_SERVICE}`);
  });
}

process.on("SIGINT", async () => {
  console.log("\n[QVAC Server] Shutting down...");
  await shutdownTTS();
  await shutdownRAG();
  await shutdown();
  server.close();
  process.exit(0);
});

start().catch((err) => {
  console.error("[QVAC Server] Failed to start:", err);
  process.exit(1);
});
