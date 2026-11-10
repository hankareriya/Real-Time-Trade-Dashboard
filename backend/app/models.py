from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    UniqueConstraint,
    Index
)

from datetime import datetime

from app.database import Base


# ==========================================
# TABLE 1: TRADES
# ==========================================

class Trade(Base):

    __tablename__ = "trades"

    # Primary key
    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    # Unique trade identifier
    trade_id = Column(
        String(50),
        nullable=False,
        unique=True
    )

    # Client name
    client = Column(
        String(100),
        nullable=False
    )

    # Stock symbol
    symbol = Column(
        String(30),
        nullable=False
    )

    # Number of shares
    quantity = Column(
        Integer,
        nullable=False
    )

    # Trade execution price
    price = Column(
        Float,
        nullable=False
    )

    # Trade execution timestamp
    timestamp = Column(
        DateTime,
        nullable=False
    )

    # Additional database constraints
    __table_args__ = (
        UniqueConstraint(
            "trade_id",
            name="uq_trade_id"
        ),
        Index("idx_trade_symbol", "symbol"),
        Index("idx_trade_timestamp", "timestamp"),
    )


# ==========================================
# TABLE 2: PULL JOBS
# ==========================================

class PullJob(Base):
    __tablename__ = "pull_jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    status = Column(String(20), nullable=False, default="pending")

    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    completed_at = Column(DateTime, nullable=True)

    total_fetched = Column(Integer, nullable=False, default=0)

    total_records = Column(Integer, nullable=False, default=0)

    error_message = Column(Text, nullable=True)