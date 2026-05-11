"use client";

const QVAC_CAPABILITIES = [
  {
    title: "LLM Inference",
    description:
      "Llama 3.2 1B via @qvac/llm-llamacpp -- trade reasoning, risk assessment, market analysis",
  },
  {
    title: "Embeddings + RAG",
    description:
      "EmbeddingGemma 300M -- local knowledge base of trading rules, queried before each decision",
  },
  {
    title: "Text-to-Speech",
    description:
      "Chatterbox TTS -- speak trade reasoning aloud, all on-device",
  },
  {
    title: "ML Prediction",
    description:
      "XGBoost + SHAP -- 14 indicators, explainable predictions",
  },
];

const SDK_FUNCTIONS = [
  {
    name: "loadModel",
    description: "Load LLM, embedding, or TTS model into memory",
  },
  {
    name: "completion",
    description: "Run LLM inference for trade reasoning and risk assessment",
  },
  {
    name: "ragChunk",
    description: "Split trading rules and guides into indexable chunks",
  },
  {
    name: "ragIngest",
    description: "Embed and store chunks into the local vector index",
  },
  {
    name: "ragSearch",
    description: "Query the knowledge base for relevant context before each trade",
  },
  {
    name: "textToSpeech",
    description: "Convert trade reasoning text to spoken audio on-device",
  },
  {
    name: "unloadModel",
    description: "Free model from memory when switching capabilities",
  },
];

const RAG_STEPS = [
  "Trading Rules + Market Context + SHAP Guide",
  "Embed (EmbeddingGemma)",
  "Index",
  "Query before each trade",
  "Context prepended to LLM prompt",
];

export default function PresentationPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Slide 1: Title */}
      <section className="py-20 px-6 flex flex-col items-center justify-center min-h-screen text-center border-b border-gray-800">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
          <span className="text-amber-400">VAPM-QVAC</span>
          <span className="text-gray-400"> -- </span>
          Sovereign AI Trading Agent
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl">
          All inference runs locally. No cloud. No data leakage.
        </p>
        <p className="mt-4 text-lg text-gray-400">
          Frontier Hackathon -- Tether QVAC Track
        </p>
        <p className="mt-2 text-lg text-gray-500">
          Built by Sarthak Biswas
        </p>
        <div className="mt-8 flex gap-6 text-sm">
          <a
            href="https://vapm-qvac-frontend.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
          >
            Frontend
          </a>
          <span className="text-gray-600">|</span>
          <a
            href="https://github.com/sarthakbiswas97/vapm-qvac"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Slide 2: The Problem */}
      <section className="py-20 px-6 flex flex-col items-center justify-center min-h-screen text-center border-b border-gray-800">
        <h2 className="text-4xl font-bold text-amber-400">The Problem</h2>
        <p className="mt-8 text-2xl md:text-3xl font-semibold text-gray-100 max-w-3xl">
          Cloud AI leaks your trading strategy
        </p>
        <p className="mt-6 text-lg text-gray-300 max-w-2xl">
          Every API call sends your market data, signals, and reasoning to a
          third-party server
        </p>
        <p className="mt-4 text-lg text-gray-400 max-w-2xl">
          Your alpha is one API log away from being copied
        </p>
      </section>

      {/* Slide 3: Four QVAC Capabilities */}
      <section className="py-20 px-6 flex flex-col items-center min-h-screen border-b border-gray-800">
        <h2 className="text-4xl font-bold text-amber-400 text-center">
          Four QVAC Capabilities
        </h2>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
          {QVAC_CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-amber-400/40 transition-colors"
            >
              <h3 className="text-xl font-semibold text-amber-400">
                {cap.title}
              </h3>
              <p className="mt-3 text-lg text-gray-300 leading-relaxed">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Slide 4: RAG Pipeline */}
      <section className="py-20 px-6 flex flex-col items-center min-h-screen border-b border-gray-800">
        <h2 className="text-4xl font-bold text-amber-400 text-center">
          RAG Pipeline
        </h2>
        <p className="mt-4 text-lg text-gray-300">
          Knowledge-grounded reasoning
        </p>
        <div className="mt-12 flex flex-col items-center gap-4 max-w-3xl w-full">
          {RAG_STEPS.map((step, i) => (
            <div key={step} className="flex flex-col items-center w-full">
              <div className="rounded-lg border border-gray-700 bg-gray-900 px-6 py-4 text-center w-full">
                <p className="text-lg text-gray-200 font-mono">{step}</p>
              </div>
              {i < RAG_STEPS.length - 1 && (
                <div className="text-amber-400 text-2xl my-1 select-none">
                  &#8595;
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-10 text-lg text-gray-400 italic max-w-2xl text-center">
          The agent doesn&apos;t just predict -- it reasons with domain
          expertise
        </p>
      </section>

      {/* Slide 5: SDK Functions Used */}
      <section className="py-20 px-6 flex flex-col items-center min-h-screen border-b border-gray-800">
        <h2 className="text-4xl font-bold text-amber-400 text-center">
          SDK Functions Used
        </h2>
        <div className="mt-12 max-w-3xl w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-3 px-4 text-amber-400 font-semibold text-lg">
                  Function
                </th>
                <th className="py-3 px-4 text-amber-400 font-semibold text-lg">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody>
              {SDK_FUNCTIONS.map((fn) => (
                <tr
                  key={fn.name}
                  className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-gray-100">
                    {fn.name}
                  </td>
                  <td className="py-3 px-4 text-lg text-gray-300">
                    {fn.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-8 text-lg text-gray-400 text-center">
          7 SDK functions across 4 capabilities -- not a wrapper, not a demo
        </p>
      </section>

      {/* Slide 6: Sovereign Intelligence */}
      <section className="py-20 px-6 flex flex-col items-center justify-center min-h-screen text-center">
        <h2 className="text-4xl font-bold text-amber-400">
          Sovereign Intelligence
        </h2>
        <p className="mt-8 text-2xl md:text-3xl font-semibold text-gray-100 max-w-3xl">
          Your strategy never leaves your device
        </p>
        <p className="mt-6 text-lg text-gray-300 max-w-2xl">
          No API keys. No network requests. No vendor lock-in.
        </p>
        <a
          href="https://vapm-qvac-frontend.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block rounded-lg bg-amber-400 px-8 py-3 text-lg font-semibold text-gray-950 hover:bg-amber-300 transition-colors"
        >
          Try it: vapm-qvac-frontend.vercel.app
        </a>
      </section>
    </main>
  );
}
