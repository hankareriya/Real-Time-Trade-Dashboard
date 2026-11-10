
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Trade


router = APIRouter(
    prefix="/api/trades",
    tags=["Trades"]
)


@router.get("")
def get_dashboard_trades(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Fetch stored trades from MySQL for the dashboard.
    """

    # Count total stored trades
    total = db.query(Trade).count()

    # Fetch a particular page of trades
    trades = (
        db.query(Trade)
        .order_by(Trade.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Convert database objects into JSON-friendly dictionaries
    trade_records = []

    for trade in trades:
        trade_records.append({
            "id": trade.id,
            "trade_id": trade.trade_id,
            "client": trade.client,
            "symbol": trade.symbol,
            "quantity": trade.quantity,
            "price": trade.price,
            "timestamp": trade.timestamp
        })

    return {
        "trades": trade_records,
        "total": total,
        "offset": offset,
        "limit": limit,
        "has_more": offset + len(trade_records) < total
    }
