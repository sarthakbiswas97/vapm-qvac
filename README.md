# VAPM-QVAC: Sovereign AI Trading Agent

> An autonomous AI trading agent where ALL inference runs locally via QVAC SDK. No cloud APIs. No data leakage. Your strategy never leaves your device.

**Hackathon:** Frontier Hackathon (Tether QVAC Side Track)

---

## The Problem

AI trading agents today rely on cloud APIs for inference. Every prediction request sends your market data, position sizes, and strategy signals to a third-party server. Your alpha leaks. Your privacy is gone. Your strategy is one API log away from being copied.

## The Solution

VAPM-QVAC runs ALL AI inference locally using Tether's QVAC SDK:

- **XGBoost price prediction** -- trained model runs on your machine
- **QVAC local LLM (Llama 3.2)** -- explains trade reasoning in natural language, assesses risk, analyzes market conditions. All on-device, zero cloud calls.
- **Dune SIM** -- real-time wallet data and transaction history

The agent's strategy, predictions, and reasoning never leave your device. This is sovereign intelligence for trading.

## How QVAC Is Used (Core Integration)

QVAC is not a wrapper or demo. It provides three critical capabilities that run the agent's decision-making:

### 1. Trade Reasoning
The XGBoost model outputs "BUY with 72% confidence." But WHY? QVAC's local LLM reads the SHAP feature importances and generates a natural language explanation: "RSI is oversold at 35, MACD just crossed bullish, and volatility is declining -- conditions favor a long entry."

### 2. Risk Assessment
Before every trade, QVAC's local LLM evaluates whether the proposed trade violates risk limits and whether the confidence level justifies the position size. This is an AI-powered risk manager running entirely on your hardware.

### 3. Market Analysis
QVAC analyzes raw technical indicators and produces a human-readable market summary. No cloud API needed -- the analysis runs in milliseconds on your GPU via Vulkan.

**Without QVAC:** The agent can predict UP/DOWN but cannot explain why, cannot assess risk in natural language, and cannot analyze market conditions. It becomes a black box.

## How Dune SIM Is Used

Dune SIM provides real-time wallet data:
- Wallet balance tracking across Solana tokens
- Transaction history for portfolio analysis
- Token metadata enrichment

Replaces raw Solana RPC calls with SIM's pre-enriched data (200ms from block propagation).

## Architecture

```
QVAC Local LLM (Llama 3.2 1B, on-device)
  |
  |-- Trade Reasoning: "WHY should we buy?"
  |-- Risk Assessment: "SHOULD we buy given current risk?"
  |-- Market Analysis: "WHAT do the indicators say?"
  |
XGBoost ML Model (local Python)
  |
  |-- Price Prediction: UP/DOWN + confidence
  |-- SHAP Explanation: feature importances
  |
Dune SIM API
  |
  |-- Wallet balances
  |-- Transaction history
  |
Agent Decision -> Execute or Reject
```

## Quick Start

```bash
# 1. Install Node.js dependencies (QVAC SDK)
npm install

# 2. Start the ML prediction service
cd backend && pip install fastapi uvicorn joblib && python main.py &

# 3. Run the agent (downloads model on first run)
node src/agent.js

# Optional: Set Dune SIM API key
export DUNE_SIM_API_KEY=your_key_here

# Test QVAC reasoner directly
node src/qvac-reasoner.js
```

## Requirements

- Node.js >= 22.17
- Python 3.11+
- GPU with Vulkan support (QVAC uses hardware-agnostic GPU inference)
- ~700MB disk for the Llama 3.2 1B model (downloaded once)

## Project Structure

```
vapm-qvac/
  src/
    agent.js            -- Main agent orchestrator
    qvac-reasoner.js    -- QVAC local LLM integration (reasoning, risk, analysis)
    dune-sim.js         -- Dune SIM wallet data client
  backend/
    main.py             -- FastAPI ML prediction service
  ml/
    models/             -- XGBoost model + comparison results
    backtest_results.json
```

## Key QVAC Capabilities Used

| Capability | Package | Usage |
|------------|---------|-------|
| LLM Inference | `@qvac/llm-llamacpp` (via `@qvac/sdk`) | Trade reasoning, risk assessment, market analysis |
| Local Model | `LLAMA_3_2_1B_INST_Q4_0` | Quantized Llama 3.2, runs on any GPU |
| Streaming | `completion({ stream: true })` | Real-time token streaming for responsive UX |

## Why Local AI Matters for Trading

| Cloud AI | QVAC Local AI |
|----------|---------------|
| Every request sends your data to a server | Data never leaves your device |
| API provider sees your strategy | Nobody sees your strategy |
| Dependent on internet connection | Works offline |
| API costs per request | One-time model download |
| Provider can log and sell your patterns | Sovereign -- you own everything |

---

Built for the Frontier Hackathon, Tether QVAC Side Track.
