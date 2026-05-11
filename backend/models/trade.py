"""Trade-related Pydantic models."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TradeStatus(str, Enum):
    """Trade execution status."""

    PENDING = "pending"
    SUBMITTED = "submitted"
    EXECUTED = "executed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TradeIntent(BaseModel):
    """Signed trade intent for Solana execution via Jupiter."""

    agent_address: str
    asset: str = "SOL"
    action: str  # BUY or SELL
    amount: str  # Amount in lamports/atomic units as string
    max_slippage_bps: int = 50  # 0.5% = 50 basis points
    deadline: int  # Unix timestamp
    decision_hash: str
    nonce: int


class Trade(BaseModel):
    """Executed trade record."""

    id: str
    decision_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    asset: str
    action: str
    amount: float
    price: float
    value_usd: float

    status: TradeStatus = TradeStatus.PENDING
    tx_hash: Optional[str] = None
    slot: Optional[int] = None
    slippage_actual_bps: Optional[int] = None

    error_message: Optional[str] = None


class Position(BaseModel):
    """Current position state."""

    asset: str
    size: float  # Amount of asset
    entry_price: float
    current_price: float
    unrealized_pnl: float
    unrealized_pnl_pct: float

    @property
    def value_usd(self) -> float:
        return self.size * self.current_price


class Portfolio(BaseModel):
    """Portfolio state."""

    total_capital: float
    available_capital: float
    positions: list[Position] = Field(default_factory=list)
    total_pnl: float = 0.0
    daily_pnl: float = 0.0

    @property
    def exposure_pct(self) -> float:
        """Calculate current exposure as percentage of capital."""
        position_value = sum(p.value_usd for p in self.positions)
        return position_value / self.total_capital if self.total_capital > 0 else 0
