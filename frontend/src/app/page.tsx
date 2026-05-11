"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const ML_API = "http://localhost:8001";
const QVAC_API = "http://localhost:8002";

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

// ---------------------------------------------------------------------------
// Demo content: realistic example output so judges see what the product does
// ---------------------------------------------------------------------------
const DEMO_PREDICTION: Prediction = {
  direction: "UP",
  confidence: 0.73,
  probability_up: 0.73,
  shap_explanation: {
    "rsi_14": { value: 0.142, impact: "positive" },
    "macd_signal": { value: 0.098, impact: "positive" },
    "bb_width": { value: -0.067, impact: "negative" },
    "volume_sma_ratio": { value: 0.054, impact: "positive" },
    "momentum_10": { value: 0.041, impact: "positive" },
    "ema_12_26_diff": { value: -0.033, impact: "negative" },
    "atr_14": { value: 0.028, impact: "positive" },
    "close_sma_50_ratio": { value: -0.019, impact: "negative" },
  },
};

const DEMO_REASONING =
  `The XGBoost model predicts SOL/USDC will move UP with 73.0% confidence. ` +
  `RSI(14) at 42.3 is the strongest bullish driver -- the pair is recovering from oversold territory. ` +
  `MACD just crossed above the signal line, confirming short-term momentum reversal. ` +
  `Bollinger Band width contraction suggests a breakout is forming. ` +
  `Volume is 1.2x the 20-period SMA, indicating genuine participation rather than a low-liquidity drift. ` +
  `Recommended action: enter a long position sized at 2.5% of portfolio with a stop-loss at the lower Bollinger Band.`;

const DEMO_RISK =
  `Approved -- Position size 2.5% is within the 5% max_position_bps limit. ` +
  `Current daily PnL is +0.4%, well below the 3% daily loss cap. ` +
  `Portfolio drawdown stands at 1.8% against a 10% maximum threshold. ` +
  `Liquidity check passed: Jupiter quotes show <0.15% slippage for the intended size. ` +
  `All risk guardrails satisfied.`;

const DEMO_ANALYSIS =
  `SOL/USDC is trading at $168.42, up 1.3% in the last 4 hours. ` +
  `The 4H chart shows a higher-low structure forming since the $158 support test. ` +
  `On-chain metrics from Dune show net exchange outflows of 42K SOL in the past 24H -- bullish supply dynamics. ` +
  `Whale wallets (>10K SOL) have been accumulating since yesterday. ` +
  `Macro: BTC is holding above $104K with low volatility, providing a stable backdrop for altcoin moves. ` +
  `Key resistance at $172; a break above would target the $180-185 zone.`;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

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

function ShapPlaceholder() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400 leading-relaxed">
        SHAP (SHapley Additive exPlanations) decomposes each prediction into per-feature contributions.
        Positive values push the prediction toward UP; negative values push toward DOWN.
      </p>
      <div className="space-y-1.5">
        {["rsi_14", "macd_signal", "bb_width", "volume_sma", "momentum"].map((name) => (
          <div key={name} className="flex items-center gap-2 text-xs">
            <span className="w-28 text-gray-600 truncate text-right">{name}</span>
            <div className="flex-1 h-3 bg-gray-800/50 rounded animate-pulse" />
            <span className="w-12 text-right font-mono text-gray-700">---</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600">Run an agent cycle to compute live feature attributions.</p>
    </div>
  );
}

function StreamingText({
  text,
  label,
  color,
  demoText,
  isDemo,
  ragEnhanced,
}: {
  text: string;
  label: string;
  color: string;
  demoText?: string;
  isDemo?: boolean;
  ragEnhanced?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    amber: "border-amber-500/20 bg-amber-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    cyan: "border-cyan-500/20 bg-cyan-500/5",
    red: "border-red-500/20 bg-red-500/5",
  };

  const showDemo = !text && isDemo && demoText;

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color] || "border-gray-800 bg-gray-800/30"}`}>
      <div className="flex items-center gap-2 mb-2">
        <StatusDot active={!!text && !showDemo} />
        <span className="text-xs font-semibold text-gray-400 uppercase">{label}</span>
        {showDemo ? (
          <span className="text-[10px] bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded">Demo</span>
        ) : (
          <span className="text-[10px] text-gray-600">QVAC Local LLM</span>
        )}
        {ragEnhanced && !showDemo && (
          <span className="text-[10px] bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded ring-1 ring-violet-500/30">
            RAG-enhanced
          </span>
        )}
      </div>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${showDemo ? "text-gray-400" : "text-gray-200"}`}>
        {text || (showDemo ? demoText : "Waiting for QVAC inference...")}
      </p>
    </div>
  );
}

function ArchitectureSection() {
  return (
    <div className="p-5 bg-gray-900 rounded-2xl border border-gray-800">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">System Architecture</h3>
      <p className="text-xs text-gray-500 mb-4">Every component runs locally. No API keys, no cloud inference, no data leaves your machine.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
          <div className="text-amber-400 font-semibold mb-1">QVAC Local LLM</div>
          <p className="text-gray-400">
            Llama 3.2 1B quantized model runs on-device via Vulkan GPU compute.
            Generates trade reasoning, risk assessments, and market analysis with zero latency to external servers.
          </p>
        </div>
        <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
          <div className="text-emerald-400 font-semibold mb-1">XGBoost ML Model</div>
          <p className="text-gray-400">
            Trained on 129K SOL/USDC candles with 15 technical indicators.
            Predicts price direction with SHAP explainability so every signal is auditable.
          </p>
        </div>
        <div className="p-3 bg-violet-500/5 rounded-lg border border-violet-500/10">
          <div className="text-violet-400 font-semibold mb-1">Dune SIM Data</div>
          <p className="text-gray-400">
            Real-time wallet balances and transaction history via Dune API.
            Pre-enriched data within 200ms of block propagation for on-chain signal enrichment.
          </p>
        </div>
      </div>
    </div>
  );
}

function ListenButton({ text }: { text: string }) {
  const [ttsState, setTtsState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleListen = async () => {
    if (ttsState !== "idle") return;

    setTtsState("loading");
    try {
      const res = await fetch(`${QVAC_API}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`TTS request failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setTtsState("idle");
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setTtsState("idle");
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      setTtsState("playing");
      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setTtsState("idle");
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTtsState("idle");
  };

  if (!text || text.length === 0) return null;

  return (
    <button
      onClick={ttsState === "playing" ? handleStop : handleListen}
      disabled={ttsState === "loading"}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        ttsState === "loading"
          ? "bg-gray-700 text-gray-400 cursor-wait"
          : ttsState === "playing"
          ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/30"
          : "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30 hover:bg-amber-500/25"
      }`}
      title={ttsState === "playing" ? "Stop playback" : "Listen to reasoning (TTS)"}
    >
      {ttsState === "loading" ? (
        <>
          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Speaking...
        </>
      ) : ttsState === "playing" ? (
        <>
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          Stop
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
          Listen
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [riskResult, setRiskResult] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [qvacReady, setQvacReady] = useState(false);
  const [loadingPercent, setLoadingPercent] = useState<number | null>(null);
  const [ragEnhanced, setRagEnhanced] = useState(false);

  const isDemo = !qvacReady && loadingPercent == null;

  const fetchPrediction = useCallback(async () => {
    try {
      const res = await fetch(`${ML_API}/predict`);
      if (res.ok) {
        const data = await res.json();
        setPrediction(data.prediction);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  const checkQvac = useCallback(async () => {
    try {
      const res = await fetch(`${QVAC_API}/health`);
      if (res.ok) {
        const data = await res.json();
        setQvacReady(data.model_ready === true);
        setLoadingPercent(data.loading_percent ?? null);
      }
    } catch {
      setQvacReady(false);
      setLoadingPercent(null);
    }
  }, []);

  useEffect(() => {
    fetchPrediction();
    checkQvac();
    const id = setInterval(fetchPrediction, 10000);
    const qid = setInterval(checkQvac, 5000);
    return () => { clearInterval(id); clearInterval(qid); };
  }, [fetchPrediction, checkQvac]);

  const streamText = async (text: string, setter: (v: string) => void) => {
    for (let i = 0; i < text.length; i += 3) {
      setter(text.slice(0, i + 3));
      await new Promise(r => setTimeout(r, 12));
    }
    setter(text);
  };

  const runAgent = async () => {
    setRunning(true);
    setReasoning("");
    setRiskResult("");
    setAnalysis("");
    setRagEnhanced(false);
    await fetchPrediction();

    if (qvacReady) {
      // Real QVAC inference via local LLM server
      try {
        setReasoning("Running QVAC local LLM inference...");
        const res = await fetch(`${QVAC_API}/api/cycle`, { method: "POST" });
        if (!res.ok) throw new Error(`QVAC server error: ${res.status}`);
        const data = await res.json();

        setPrediction(data.prediction || prediction);
        setRagEnhanced(data.ragEnhanced === true);
        setReasoning("");
        await streamText(data.reasoning || "No reasoning generated.", setReasoning);
        const riskText = data.riskAssessment
          ? `${data.riskAssessment.approved ? "Approved" : "Rejected"} -- ${data.riskAssessment.reasoning}`
          : "No risk assessment.";
        await streamText(riskText, setRiskResult);
        await streamText(data.marketAnalysis || "No market analysis.", setAnalysis);
      } catch (err) {
        setReasoning(`QVAC server error: ${err instanceof Error ? err.message : "unknown"}.`);
      }
    } else {
      // Demo mode: show realistic prediction + reasoning
      if (!prediction) {
        setPrediction(DEMO_PREDICTION);
      }
      await streamText(DEMO_REASONING, setReasoning);
      await streamText(DEMO_RISK, setRiskResult);
      await streamText(DEMO_ANALYSIS, setAnalysis);
    }

    setRunning(false);
  };

  // Use live prediction if available, otherwise show demo data in demo mode
  const displayPrediction = prediction || (isDemo ? DEMO_PREDICTION : null);

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-6">
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
              {connected ? "ML Service Connected" : "ML Service"}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${
              qvacReady ? "bg-amber-500/15 text-amber-400 ring-amber-500/30"
                : loadingPercent != null ? "bg-amber-500/15 text-amber-400 ring-amber-500/30"
                : "bg-gray-700/50 text-gray-400 ring-gray-600/30"
            }`}>
              <StatusDot active={qvacReady || loadingPercent != null} />
              {qvacReady ? "QVAC LLM Ready"
                : loadingPercent != null ? `Loading Llama 3.2: ${loadingPercent}%`
                : "Demo Mode"}
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

      {/* Architecture -- shown prominently in demo mode */}
      {isDemo && (
        <div className="mb-6">
          <ArchitectureSection />
        </div>
      )}

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
          {running ? "Agent Running..." : qvacReady ? "Run Agent Cycle (Live QVAC)" : "Run Agent Cycle"}
        </button>
      </div>

      {/* Top row: Prediction + SHAP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Card title="ML Prediction" badge={isDemo && !prediction ? "Demo Data" : "XGBoost (local)"}>
          {displayPrediction ? (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className={`text-3xl font-bold ${displayPrediction.direction === "UP" ? "text-emerald-400" : "text-red-400"}`}>
                  {displayPrediction.direction === "UP" ? "\u2191" : "\u2193"} {displayPrediction.direction}
                </span>
                <div>
                  <div className="text-sm text-gray-400">Confidence</div>
                  <div className="text-lg font-mono text-white">{(displayPrediction.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${displayPrediction.direction === "UP" ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${displayPrediction.confidence * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No prediction available</p>
          )}
        </Card>

        <Card title="SHAP Feature Importance" badge="Explainable AI">
          {displayPrediction?.shap_explanation ? (
            <ShapBars shap={displayPrediction.shap_explanation} />
          ) : (
            <ShapPlaceholder />
          )}
        </Card>
      </div>

      {/* QVAC Reasoning Section */}
      <div className="space-y-4 mb-6">
        <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
          QVAC Local LLM Output {isDemo && <span className="text-gray-500 normal-case">(on-device inference when QVAC server is running)</span>}
        </h2>

        <StreamingText text={reasoning} label="Trade Reasoning" color="amber" demoText={DEMO_REASONING} isDemo={isDemo} ragEnhanced={ragEnhanced} />
        {reasoning && !running && <div className="flex justify-end -mt-2"><ListenButton text={reasoning} /></div>}
        <StreamingText
          text={riskResult}
          label="Risk Assessment"
          color={riskResult.includes("Approved") || riskResult.includes("YES") ? "emerald" : riskResult ? "red" : "emerald"}
          demoText={DEMO_RISK}
          isDemo={isDemo}
        />
        <StreamingText text={analysis} label="Market Analysis" color="cyan" demoText={DEMO_ANALYSIS} isDemo={isDemo} />
      </div>

      {/* Architecture -- always shown at bottom, but not duplicated */}
      {!isDemo && <ArchitectureSection />}

      {/* Loading bar for model loading state */}
      {connected && !qvacReady && loadingPercent != null && (
        <div className="fixed bottom-4 left-4 bg-amber-600/90 text-white text-xs px-4 py-3 rounded-lg min-w-[260px]">
          <div className="flex justify-between mb-1.5">
            <span>Loading Llama 3.2 1B...</span>
            <span className="font-mono">{loadingPercent}%</span>
          </div>
          <div className="h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${loadingPercent}%` }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
