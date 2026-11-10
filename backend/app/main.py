
import os
import asyncio

from pathlib import Path
from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    Query,
    HTTPException,
    WebSocket,
    WebSocketDisconnect
)

from fastapi.middleware.cors import CORSMiddleware

from app.services.mock_bse import get_trades_batch
from app.services.websocket_manager import manager

from app.routes.pulls import router as pulls_router
from app.routes.trades import router as trades_router


# -----------------------------------------
# Load environment variables
# -----------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

MOCK_API_DELAY = float(
    os.getenv("MOCK_API_DELAY_SECONDS", "1")
)


# -----------------------------------------
# Create FastAPI application
# -----------------------------------------

app = FastAPI(
    title="Trade Dashboard API",
    description="Mock BSE Trade Data API",
    version="1.0.0"
)


# -----------------------------------------
# CORS configuration
# -----------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------
# Register API routers
# -----------------------------------------

app.include_router(pulls_router)
app.include_router(trades_router)


# -----------------------------------------
# Home endpoint
# -----------------------------------------

@app.get("/")
def home():

    return {
        "message": "Welcome to Trade Dashboard API",
        "status": "running"
    }


# -----------------------------------------
# Mock BSE API
# -----------------------------------------

@app.get("/getTrades")
async def get_trades(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500)
):

    try:

        await asyncio.sleep(MOCK_API_DELAY)

        result = get_trades_batch(
            offset=offset,
            limit=limit
        )

        return result

    except FileNotFoundError as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to fetch trades: {str(error)}"
        )


# -----------------------------------------
# WebSocket endpoint
# -----------------------------------------

@app.websocket("/ws/trades")
async def trades_websocket(websocket: WebSocket):

    await manager.connect(websocket)

    try:

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(websocket)

    except Exception:

        manager.disconnect(websocket)
