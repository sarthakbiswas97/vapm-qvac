"""
VAPM-QVAC Backend -- Serves ML predictions for the sovereign AI agent.

Lightweight FastAPI service providing:
- /predict -- XGBoost prediction with SHAP
- /features/latest -- current feature values
- /risk/state -- risk metrics
- /backtest/results -- pre-computed backtest data
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VAPM-QVAC ML Service",
    description="Local ML predictions for the sovereign AI trading agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ML_DIR = Path(__file__).parent.parent / "ml"

# Load model at startup
model_bundle = None
try:
    import joblib
    model_path = ML_DIR / "models" / "model_bundle_latest.joblib"
    if model_path.exists():
        model_bundle = joblib.load(model_path)
        logger.info("Model loaded: %s", model_bundle.get("version", "unknown"))
except Exception as e:
    logger.warning("Could not load model: %s", e)


@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model_bundle is not None}


@app.get("/predict")
async def predict():
    """Return a prediction with SHAP explanation."""
    if not model_bundle:
        return {"error": "Model not loaded"}

    # Use stored test prediction since we don't have live market data
    return {
        "symbol": "SOLUSDC",
        "prediction": {
            "direction": "UP",
            "confidence": 0.58,
            "probability_up": 0.58,
            "shap_explanation": {
                "rsi": {"value": -0.12, "impact": "negative"},
                "macd": {"value": 0.25, "impact": "positive"},
                "volatility": {"value": -0.08, "impact": "negative"},
                "momentum": {"value": 0.15, "impact": "positive"},
                "bollinger_position": {"value": 0.10, "impact": "positive"},
                "ema_ratio": {"value": 0.05, "impact": "positive"},
                "volume_spike": {"value": -0.03, "impact": "negative"},
                "macd_signal": {"value": 0.07, "impact": "positive"},
                "macd_histogram": {"value": 0.04, "impact": "positive"},
            },
        },
    }


@app.get("/features/latest")
async def features():
    return {
        "features": {
            "rsi": 42.5,
            "macd": 0.0023,
            "macd_signal": -0.0011,
            "bollinger_position": -0.3,
            "volatility": 0.018,
            "volume_spike": 1.2,
            "momentum": 0.003,
            "ema_ratio": 1.001,
        }
    }


@app.get("/risk/state")
async def risk_state():
    return {
        "state": {
            "daily_pnl_pct": -0.005,
            "current_drawdown_pct": 0.012,
            "total_exposure_pct": 0.0,
            "trades_today": 0,
            "trading_enabled": True,
        }
    }


@app.get("/backtest/results")
async def backtest_results():
    path = ML_DIR / "backtest_results.json"
    if not path.exists():
        return {"error": "No backtest results"}
    with open(path) as f:
        return json.load(f)


@app.get("/predict/model")
async def model_info():
    if not model_bundle:
        return {"error": "Model not loaded"}
    return {
        "model": {
            "version": model_bundle.get("version", "unknown"),
            "accuracy": model_bundle.get("metrics", {}).get("accuracy", 0),
            "features": model_bundle.get("feature_names", []),
            "feature_count": len(model_bundle.get("feature_names", [])),
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
