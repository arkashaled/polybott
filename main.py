import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

QUIVER_TOKEN = os.environ.get("QUIVER_TOKEN", "")
PAGE_SIZE = 100

ENDPOINTS = [
    "https://api.quiverquant.com/beta/bulk/congresstrading",
    "https://api.quiverquant.com/beta/historical/congresstrading",
    "https://api.quiverquant.com/beta/bulk/housetrading",
    "https://api.quiverquant.com/beta/bulk/senatetrading",
]

app = FastAPI()
state: dict = {"trades": [], "last_updated": None, "error": None, "refreshing": False}


def dedup(trades: list) -> list:
    seen = set()
    out = []
    for t in trades:
        key = (
            t.get("BioGuideID") or t.get("representative") or t.get("Name", ""),
            t.get("Ticker", ""),
            t.get("Traded", ""),
            t.get("Transaction", ""),
        )
        if key not in seen:
            seen.add(key)
            out.append(t)
    return out


async def fetch_endpoint(client: httpx.AsyncClient, url: str) -> list:
    headers = {"Authorization": f"Bearer {QUIVER_TOKEN}", "Accept": "application/json"}
    results = []
    page = 1
    while True:
        try:
            r = await client.get(url, headers=headers,
                                 params={"page": page, "page_size": PAGE_SIZE, "version": "V2", "date": "20120101"},
                                 timeout=30)
            if r.status_code in (401, 403, 404):
                log.warning(f"{url} returned {r.status_code}, skipping")
                break
            r.raise_for_status()
            data = r.json()
            if not data or not isinstance(data, list):
                break
            results.extend(data)
            log.info(f"{url} page {page}: {len(data)} records")
            if len(data) < PAGE_SIZE:
                break
            page += 1
        except Exception as e:
            log.error(f"{url} page {page} error: {e}")
            break
    return results


async def fetch_all_trades():
    log.info("Fetching trades from all Quiver endpoints...")
    all_trades = []

    async with httpx.AsyncClient() as client:
        for url in ENDPOINTS:
            records = await fetch_endpoint(client, url)
            log.info(f"{url}: {len(records)} total records")
            all_trades.extend(records)

    all_trades = dedup(all_trades)
    # Sort newest trade first
    all_trades.sort(key=lambda t: t.get("Traded") or "", reverse=True)

    if all_trades:
        state["trades"] = all_trades
        state["last_updated"] = datetime.now(timezone.utc).isoformat()
        state["error"] = None
        log.info(f"Total unique trades loaded: {len(all_trades)}")
    else:
        state["error"] = "No data returned from any endpoint"


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


@app.post("/api/refresh")
async def refresh():
    if state["refreshing"]:
        raise HTTPException(status_code=429, detail="Refresh already in progress")
    state["refreshing"] = True
    try:
        await fetch_all_trades()
    finally:
        state["refreshing"] = False
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
