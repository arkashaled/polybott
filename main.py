import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

QUIVER_TOKEN = os.environ.get("QUIVER_TOKEN", "")
QUIVER_URL = "https://api.quiverquant.com/beta/bulk/congresstrading"
PAGE_SIZE = 100

app = FastAPI()
state: dict = {"trades": [], "last_updated": None, "error": None}


async def fetch_all_trades():
    log.info("Fetching trades from Quiver...")
    headers = {"Authorization": f"Bearer {QUIVER_TOKEN}", "Accept": "application/json"}
    all_trades = []
    page = 1

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            try:
                r = await client.get(
                    QUIVER_URL,
                    headers=headers,
                    params={"page": page, "page_size": PAGE_SIZE, "version": "V2"},
                )
                r.raise_for_status()
                data = r.json()
                if not data:
                    break
                all_trades.extend(data)
                log.info(f"Page {page}: {len(data)} trades")
                if len(data) < PAGE_SIZE:
                    break
                page += 1
            except Exception as e:
                log.error(f"Error on page {page}: {e}")
                state["error"] = str(e)
                break

    if all_trades:
        state["trades"] = all_trades
        state["last_updated"] = datetime.now(timezone.utc).isoformat()
        state["error"] = None
        log.info(f"Loaded {len(all_trades)} trades total")


scheduler = AsyncIOScheduler()
scheduler.add_job(fetch_all_trades, "interval", hours=2, id="fetch_trades")


@app.on_event("startup")
async def startup():
    await fetch_all_trades()
    scheduler.start()


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()


@app.get("/api/trades")
async def get_trades():
    return {
        "trades": state["trades"],
        "last_updated": state["last_updated"],
        "count": len(state["trades"]),
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "last_updated": state["last_updated"],
        "count": len(state["trades"]),
        "error": state["error"],
    }


STATIC = Path("static")

if STATIC.exists():
    if (STATIC / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        return FileResponse(STATIC / "index.html")
