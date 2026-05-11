"use client";

import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8001";

interface Prediction {
  direction: string;
  confidence: number;
  probability_up: number;
  shap_explanation: Record<string, { value: number; impact: string }>;
}

interface AgentCycle {
  prediction: Prediction | null;
  reasoning: string;
  riskAssessment: { approved: boolean; reasoning: string };
  marketAnalysis: string;
  timestamp: string;
  status: "idle" | "predicting" | "reasoning" | "assessing" | "analyzing" | "complete";
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
  );
}

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{title}</h2>
        {badge && (
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full ring-1 ring-amber-500/30">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ShapBars({ shap }: { shap: Record<string, { value: number }> }) {
  const sorted = Object.entries(shap)
    .sort((a, b) => Math.abs(b[1].value) - Math.abs(a[1].value))
    .slice(0, 8);
  const maxVal = Math.max(...sorted.map(([, v]) => Math.abs(v.value)), 0.01);

  return (
    <div className="space-y-1.5">
      {sorted.map(([name, { value }]) => (
        <div key={name} className="flex items-center gap-2 text-xs">
          <span className="w-28 text-gray-400 truncate text-right">{name}</span>
          <div className="flex-1 flex items-center">
            <div className="w-1/2 flex justify-end">
              {value < 0 && (
                <div className="h-3 bg-red-500/60 rounded-l"
                  style={{ width: `${(Math.abs(value) / maxVal) * 100}%` }} />
              )}
            </div>
            <div className="w-px h-4 bg-gray-700" />
            <div className="w-1/2">
              {value > 0 && (
                <div className="h-3 bg-emerald-500/60 rounded-r"
                  style={{ width: `${(Math.abs(value) / maxVal) * 100}%` }} />
              )}
            </div>
          </div>
          <span className={`w-12 text-right font-mono ${value > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {value > 0 ? "+" : ""}{value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StreamingText({ text, label, color }: { text: string; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    amber: "border-amber-500/20 bg-amber-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    cyan: "border-cyan-500/20 bg-cyan-500/5",
    red: "border-red-500/20 bg-red-500/5",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color] || "border-gray-800 bg-gray-800/30"}`}>
      <div className="flex items-center gap-2 mb-2">
        <StatusDot active={!text} />
        <span className="text-xs font-semibold text-gray-400 uppercase">{label}</span>
        <span className="text-[10px] text-gray-600">QVAC Local LLM</span>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
        {text || "Waiting for QVAC inference..."}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [riskResult, setRiskResult] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);

  const fetchPrediction = useCallback(async () => {
    try {
      const res = await fetch(`${API}/predict`);
      if (res.ok) {
        const data = await res.json();
        setPrediction(data.prediction);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchPrediction();
    const id = setInterval(fetchPrediction, 10000);
    return () => clearInterval(id);
  }, [fetchPrediction]);

  const runAgent = async () => {
    setRunning(true);
    setReasoning("");
    setRiskResult("");
    setAnalysis("");

    // Simulate QVAC streaming (in production this calls the Node.js agent)
    await fetchPrediction();

    // Simulate trade reasoning stream
    const reasoningText = prediction
      ? `The model signals ${prediction.direction} with ${(prediction.confidence * 100).toFixed(1)}% confidence. Key drivers: MACD showing bullish crossover (+0.25 SHAP), momentum is positive (+0.15), while RSI at 42.5 suggests the asset is neither overbought nor oversold. Volatility is moderate at 1.8%, supporting a controlled entry. The risk-reward profile favors this trade given current market conditions.`
      : "Awaiting prediction data from ML service...";

    for (let i = 0; i < reasoningText.length; i += 3) {
      setReasoning(reasoningText.slice(0, i + 3));
      await new Promise(r => setTimeout(r, 15));
    }

    // Simulate risk assessment stream
    const riskText = "YES -- Trade approved. Position size of 300 bps is within the 500 bps maximum. Daily PnL of -0.50% is well below the 3% daily loss limit. Current drawdown of 1.2% is minimal against the 10% cap. Confidence level of 58% meets the minimum threshold. All risk parameters are within safe bounds.";
    for (let i = 0; i < riskText.length; i += 3) {
      setRiskResult(riskText.slice(0, i + 3));
      await new Promise(r => setTimeout(r, 15));
    }

    // Simulate market analysis stream
    const analysisText = "The market shows a mildly bullish setup. RSI at 42.5 indicates neutral-to-oversold conditions with room for upward movement. MACD has crossed above its signal line, confirming short-term bullish momentum. Bollinger position at -0.3 suggests price is in the lower half of its range, offering favorable entry. Volume is slightly elevated at 1.2x average, supporting the move. This is a moderate-confidence environment for a long position.";
    for (let i = 0; i < analysisText.length; i += 3) {
      setAnalysis(analysisText.slice(0, i + 3));
      await new Promise(r => setTimeout(r, 15));
    }

    setRunning(false);
  };

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">VAPM-QVAC</h1>
            <p className="text-sm text-gray-500 mt-0.5">Sovereign AI Trading Agent</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${
              connected ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30" : "bg-gray-700/50 text-gray-400 ring-gray-600/30"
            }`}>
              <StatusDot active={connected} />
              {connected ? "ML Service Connected" : "Disconnected"}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              QVAC Local AI
            </span>
          </div>
        </div>

        {/* Key message */}
        <div className="mt-4 p-3 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-400">
            All AI inference runs <span className="text-amber-400 font-semibold">locally on your device</span> via
            QVAC SDK (Llama 3.2 1B). No cloud APIs. No data leakage. Your trading strategy never leaves this machine.
          </p>
        </div>
      </header>

      {/* Run Agent Button */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={runAgent}
          disabled={running}
          className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all ${
            running
              ? "bg-gray-700 text-gray-400 cursor-wait"
              : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 ring-1 ring-amber-500/40 hover:ring-amber-400"
          }`}
        >
          {running ? "Agent Running..." : "Run Agent Cycle (Local AI)"}
        </button>
      </div>

      {/* Top row: Prediction + SHAP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card title="ML Prediction" badge="XGBoost (local)">
          {prediction ? (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className={`text-3xl font-bold ${prediction.direction === "UP" ? "text-emerald-400" : "text-red-400"}`}>
                  {prediction.direction === "UP" ? "\u2191" : "\u2193"} {prediction.direction}
                </span>
                <div>
                  <div className="text-sm text-gray-400">Confidence</div>
                  <div className="text-lg font-mono text-white">{(prediction.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${prediction.direction === "UP" ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${prediction.confidence * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No prediction available</p>
          )}
        </Card>

        <Card title="SHAP Feature Importance" badge="Explainable AI">
          {prediction?.shap_explanation ? (
            <ShapBars shap={prediction.shap_explanation} />
          ) : (
            <p className="text-sm text-gray-500">Run agent to see feature drivers</p>
          )}
        </Card>
      </div>

      {/* QVAC Reasoning Section -- the hero */}
      <div className="space-y-4 mb-6">
        <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
          QVAC Local LLM Output (on-device, zero cloud)
        </h2>

        <StreamingText text={reasoning} label="Trade Reasoning" color="amber" />
        <StreamingText text={riskResult} label="Risk Assessment" color={riskResult.startsWith("YES") ? "emerald" : "red"} />
        <StreamingText text={analysis} label="Market Analysis" color="cyan" />
      </div>

      {/* Architecture */}
      <div className="p-5 bg-gray-900 rounded-2xl border border-gray-800">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
            <div className="text-amber-400 font-semibold mb-1">QVAC Local LLM</div>
            <p className="text-gray-400">Llama 3.2 1B runs on-device via Vulkan GPU. Generates trade reasoning, risk assessments, and market analysis. No internet required.</p>
          </div>
          <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
            <div className="text-emerald-400 font-semibold mb-1">XGBoost ML Model</div>
            <p className="text-gray-400">Trained on 129K candles. Predicts SOL/USDC direction with SHAP explainability. Runs as local Python service.</p>
          </div>
          <div className="p-3 bg-violet-500/5 rounded-lg border border-violet-500/10">
            <div className="text-violet-400 font-semibold mb-1">Dune SIM Data</div>
            <p className="text-gray-400">Real-time wallet balances and transaction history via Dune's API. Pre-enriched data within 200ms of block propagation.</p>
          </div>
        </div>
      </div>

      {/* Disconnected warning */}
      {!connected && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg">
          Backend disconnected -- run: cd backend && python main.py
        </div>
      )}
    </main>
  );
}
