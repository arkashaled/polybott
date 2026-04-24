import json
import logging
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

QUIVER_TOKEN = os.environ.get("QUIVER_TOKEN", "")
QUIVER_URL = "https://api.quiverquant.com/beta/bulk/congresstrading"
PAGE_SIZE = 100

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_TO = "arkashaled@gmail.com"

app = FastAPI()
state: dict = {"trades": [], "last_updated": None, "error": None, "refreshing": False}


async def fetch_all_trades():
    log.info("Fetching trades from Quiver...")
    headers = {"Authorization": f"Bearer {QUIVER_TOKEN}", "Accept": "application/json"}
    all_trades = []
    page = 1

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            try:
                r = await client.get(
                    QUIVER_URL,
                    headers=headers,
                    params={"page": page, "page_size": PAGE_SIZE, "version": "V2"},
                )
                r.raise_for_status()
                data = r.json()
                if not data or not isinstance(data, list):
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
        all_trades.sort(key=lambda t: t.get("Traded") or "", reverse=True)
        state["trades"] = all_trades
        state["last_updated"] = datetime.now(timezone.utc).isoformat()
        state["error"] = None
        log.info(f"Loaded {len(all_trades)} trades total")


def fmt_date(d):
    if not d:
        return "—"
    try:
        return datetime.fromisoformat(d.replace("Z", "+00:00")).strftime("%b %d, %Y")
    except Exception:
        return d


def calc_lag(traded, filed):
    try:
        t = datetime.fromisoformat(traded.replace("Z", "+00:00"))
        f = datetime.fromisoformat(filed.replace("Z", "+00:00"))
        return f"{(f - t).days}d"
    except Exception:
        return "—"


def get_trades_last_24h():
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = []
    for t in state["trades"]:
        raw = t.get("Filed") or t.get("Quiver_Upload_Time", "")
        if not raw:
            continue
        try:
            filed_dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if filed_dt >= cutoff:
                recent.append(t)
        except Exception:
            continue
    return recent


def build_email_html(trades):
    th = "padding:8px 14px;text-align:left;border-bottom:1px solid #30363d;color:#8b949e;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap"
    td_base = "padding:8px 14px;border-bottom:1px solid #21262d;font-size:13px;white-space:nowrap"

    headers = ["Representative", "Chamber", "Ticker", "Type", "Amount", "Trade Date", "Filed", "Lag", "Party", "State", "Company"]
    header_row = "".join(f"<th style='{th}'>{h}</th>" for h in headers)

    rows_html = ""
    for i, t in enumerate(trades):
        tx = (t.get("Transaction") or "").lower()
        is_buy = "purchase" in tx
        tx_label = "BUY" if is_buy else "SELL"
        tx_color = "#3fb950" if is_buy else "#f85149"
        tx_bg = "rgba(63,185,80,0.12)" if is_buy else "rgba(248,81,73,0.12)"

        party = t.get("Party") or ""
        party_short = "D" if "Democrat" in party else "R" if "Republican" in party else party[:1] or "—"
        party_color = "#4493f8" if "Democrat" in party else "#f85149" if "Republican" in party else "#d29922"

        chamber = t.get("Chamber") or "—"
        ch_color = "#58a6ff" if chamber == "House" else "#d29922"
        ch_bg = "rgba(88,166,255,0.1)" if chamber == "House" else "rgba(210,153,34,0.1)"

        traded = t.get("Traded") or ""
        filed = t.get("Filed") or ""
        lag = calc_lag(traded, filed) if traded and filed else "—"
        rep = t.get("representative") or t.get("Name") or "—"
        row_bg = "#161b22" if i % 2 == 0 else "#0d1117"

        rows_html += f"""
        <tr style="background:{row_bg}">
          <td style="{td_base}">{rep}</td>
          <td style="{td_base}"><span style="background:{ch_bg};color:{ch_color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">{chamber}</span></td>
          <td style="{td_base};color:#58a6ff;font-family:monospace;font-weight:700">{t.get('Ticker') or '—'}</td>
          <td style="{td_base}"><span style="background:{tx_bg};color:{tx_color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">{tx_label}</span></td>
          <td style="{td_base};font-family:monospace">{t.get('Trade_Size_USD') or '—'}</td>
          <td style="{td_base}">{fmt_date(traded)}</td>
          <td style="{td_base}">{fmt_date(filed)}</td>
          <td style="{td_base}">{lag}</td>
          <td style="{td_base};color:{party_color};font-weight:700">{party_short}</td>
          <td style="{td_base}">{t.get('State') or '—'}</td>
          <td style="{td_base};color:#8b949e">{t.get('Company') or '—'}</td>
        </tr>"""

    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <h1 style="margin:0 0 4px 0;font-size:22px;letter-spacing:3px;color:#58a6ff">POLYBOTT</h1>
        <p style="margin:0 0 20px 0;color:#8b949e;font-size:14px">Congress Trading Alert &mdash; {date_str}</p>
        <p style="margin:0 0 16px 0;font-size:15px"><strong>{len(trades)}</strong> new trade(s) filed in the last 24 hours</p>
        <div style="overflow-x:auto">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#0d1117">{header_row}</tr></thead>
            <tbody>{rows_html}</tbody>
          </table>
        </div>
        <p style="margin:20px 0 0 0;font-size:12px;color:#8b949e">
          View full dashboard at <a href="https://polybott.com" style="color:#58a6ff">polybott.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_daily_digest():
    trades = get_trades_last_24h()
    log.info(f"Daily digest: {len(trades)} trades in last 24h")
    if not trades:
        log.info("No new filings, skipping email")
        return
    _send_email(trades)


scheduler = AsyncIOScheduler()
scheduler.add_job(fetch_all_trades, "interval", hours=2, id="fetch_trades")
scheduler.add_job(send_daily_digest, "cron", hour=7, minute=0, id="daily_digest")


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


@app.post("/api/send-digest")
async def send_digest_now(test: bool = False):
    import asyncio
    loop = asyncio.get_event_loop()

    if test:
        trades_24h = get_trades_last_24h()
        sample = trades_24h if trades_24h else state["trades"][:5]
        if not sample:
            return {"sent": False, "reason": "no trades loaded"}
        label = "last 24h" if trades_24h else "sample (no 24h trades yet)"
        await loop.run_in_executor(None, lambda: _send_email(sample, subject_prefix="[TEST] "))
        return {"sent": True, "trades_in_last_24h": len(trades_24h), "sent_count": len(sample), "label": label}

    await loop.run_in_executor(None, send_daily_digest)
    trades = get_trades_last_24h()
    return {"sent": True, "trades_in_last_24h": len(trades)}


def _send_email(trades, subject_prefix=""):
    if not RESEND_API_KEY:
        log.warning("RESEND_API_KEY not set")
        return
    import urllib.request, urllib.error
    payload = json.dumps({
        "from": "Polybott <onboarding@resend.dev>",
        "to": [EMAIL_TO],
        "subject": f"{subject_prefix}POLYBOTT: {len(trades)} Congress Trade(s)",
        "html": build_email_html(trades),
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "polybott/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode()
            log.info(f"Email sent: {r.status} {body}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        log.error(f"Resend error {e.code}: {body}")
    except Exception as e:
        log.error(f"Email failed: {e}")


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
