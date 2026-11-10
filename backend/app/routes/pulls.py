
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PullJob
from app.services.pull_service import pull_trades


router = APIRouter(
    prefix="/api/pulls",
    tags=["Pull Jobs"]
)


@router.post("", status_code=202)
def start_pull(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):

    # Create a new pull job in MySQL
    new_job = PullJob(
        status="pending",
        total_fetched=0,
        total_records=0
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    pull_id = new_job.id

    # Run the actual pull in the background
    background_tasks.add_task(
        pull_trades,
        pull_id
    )

    return {
        "message": "Trade pull started successfully.",
        "pull_id": pull_id,
        "status": "pending"
    }


@router.get("/{pull_id}")
def get_pull_status(
    pull_id: int,
    db: Session = Depends(get_db)
):

    job = db.query(PullJob).filter(
        PullJob.id == pull_id
    ).first()

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Pull job not found."
        )

    percentage = (
        round(
            (job.total_fetched / job.total_records) * 100,
            2
        )
        if job.total_records > 0
        else 0
    )

    return {
        "pull_id": job.id,
        "status": job.status,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "records_fetched": job.total_fetched,
        "total_records": job.total_records,
        "progress_percent": percentage,
        "error_message": job.error_message
    }
