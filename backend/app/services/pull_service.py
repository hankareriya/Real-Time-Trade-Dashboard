
import os
import time
import httpx

from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

from app.database import SessionLocal
from app.models import Trade, PullJob
from app.services.websocket_manager import manager


# Load backend environment variables
BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))

PULL_DURATION_SECONDS = int(
    os.getenv("PULL_DURATION_SECONDS", "900")
)

MOCK_BSE_API_URL = os.getenv(
    "MOCK_BSE_API_URL",
    "http://127.0.0.1:8000/getTrades"
)


def update_pull_job(
    db,
    pull_id,
    status=None,
    total_fetched=None,
    total_records=None,
    error_message=None,
    completed=False
):
    job = db.query(PullJob).filter(
        PullJob.id == pull_id
    ).first()

    if job is None:
        return None

    if status is not None:
        job.status = status

    if total_fetched is not None:
        job.total_fetched = total_fetched

    if total_records is not None:
        job.total_records = total_records

    if error_message is not None:
        job.error_message = error_message

    if completed:
        job.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(job)

    return job


def save_batch(db, trades):
    """
    Save one batch of trades.

    Existing trade IDs are skipped to avoid duplicates.
    """

    if not trades:
        return 0

    trade_ids = [
        item["trade_id"]
        for item in trades
    ]

    existing_ids = set(
        row[0]
        for row in db.query(Trade.trade_id)
        .filter(Trade.trade_id.in_(trade_ids))
        .all()
    )

    inserted_count = 0

    for item in trades:

        if item["trade_id"] in existing_ids:
            continue

        trade = Trade(
            trade_id=item["trade_id"],
            client=item["client"],
            symbol=item["symbol"],
            quantity=item["quantity"],
            price=item["price"],
            timestamp=datetime.fromisoformat(
                item["timestamp"].replace("Z", "+00:00")
            ).replace(tzinfo=None)
        )

        db.add(trade)
        inserted_count += 1

    # Commit this batch independently
    db.commit()

    return inserted_count


async def pull_trades(pull_id):

    db = SessionLocal()

    total_fetched = 0
    total_records = 0
    offset = 0
    batch_number = 0

    start_time = time.monotonic()

    try:

        # Mark job as running
        update_pull_job(
            db,
            pull_id,
            status="running"
        )

        await manager.broadcast({
            "event": "pull_started",
            "pull_id": pull_id,
            "status": "running",
            "records_fetched": 0,
            "total_records": 0,
            "progress_percent": 0,
            "message": "Trade pull started."
        })

        timeout = httpx.Timeout(30.0)

        async with httpx.AsyncClient(timeout=timeout) as client:

            while True:

                # Enforce configured pull duration
                elapsed = time.monotonic() - start_time

                if elapsed >= PULL_DURATION_SECONDS:
                    raise TimeoutError(
                        "Trade pull exceeded the configured duration."
                    )

                # Fetch next batch from mock BSE API
                response = await client.get(
                    MOCK_BSE_API_URL,
                    params={
                        "offset": offset,
                        "limit": BATCH_SIZE
                    }
                )

                response.raise_for_status()

                data = response.json()

                batch = data.get("trades", [])

                total_records = int(
                    data.get("total", 0)
                )

                # Save current batch to MySQL
                save_batch(db, batch)

                # Count records processed, including existing IDs skipped
                total_fetched += len(batch)

                batch_number += 1

                offset += len(batch)

                # Save progress in the database
                update_pull_job(
                    db,
                    pull_id,
                    status="running",
                    total_fetched=total_fetched,
                    total_records=total_records
                )

                percentage = (
                    round(
                        (total_fetched / total_records) * 100,
                        2
                    )
                    if total_records > 0
                    else 0
                )

                # Broadcast live progress
                await manager.broadcast({
                    "event": "pull_progress",
                    "pull_id": pull_id,
                    "status": "running",
                    "records_fetched": total_fetched,
                    "total_records": total_records,
                    "progress_percent": percentage,
                    "batch_number": batch_number,
                    "message": (
                        f"Processed {total_fetched} "
                        f"of {total_records} records."
                    )
                })

                # Stop when the mock API has no more records
                if not data.get("has_more", False):
                    break

                # Avoid infinite loops if API returns an empty batch
                if len(batch) == 0:
                    break

        # Mark job completed
        update_pull_job(
            db,
            pull_id,
            status="completed",
            total_fetched=total_fetched,
            total_records=total_records,
            completed=True
        )

        await manager.broadcast({
            "event": "pull_completed",
            "pull_id": pull_id,
            "status": "completed",
            "records_fetched": total_fetched,
            "total_records": total_records,
            "progress_percent": 100 if total_records else 0,
            "message": "Trade pull completed successfully."
        })

    except Exception as error:

        db.rollback()

        error_message = str(error)

        update_pull_job(
            db,
            pull_id,
            status="failed",
            total_fetched=total_fetched,
            total_records=total_records,
            error_message=error_message,
            completed=True
        )

        await manager.broadcast({
            "event": "pull_failed",
            "pull_id": pull_id,
            "status": "failed",
            "records_fetched": total_fetched,
            "total_records": total_records,
            "progress_percent": (
                round(
                    (total_fetched / total_records) * 100,
                    2
                )
                if total_records > 0
                else 0
            ),
            "message": error_message
        })

    finally:
        db.close()
