"""FastAPI backend for DSL Catcher Tracker."""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
import os

import database as db
import scoring as sc
import auth

db.init_db()
auth.ensure_default_admin()

app = FastAPI(title="DSL Catcher Tracker")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/reset-admin-password")
def reset_admin_password():
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE users SET hashed_password=? WHERE username='admin'",
            (auth.hash_password("Marlins2026"),)
        )
        conn.commit()
    return {"ok": True}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    username = auth.decode_token(creds.credentials)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = auth.get_user(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "coach"


@app.post("/api/login")
def login(body: LoginRequest):
    user = auth.authenticate(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"token": auth.create_token(user["username"]), "username": user["username"], "role": user["role"]}


@app.post("/api/users", dependencies=[Depends(current_user)])
def create_user(body: CreateUserRequest, me=Depends(current_user)):
    if me["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo admin puede crear usuarios")
    try:
        auth.create_user(body.username, body.password, body.role)
        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=400, detail="Usuario ya existe")


@app.get("/api/me")
def me(user=Depends(current_user)):
    return {"username": user["username"], "role": user["role"]}


# ── Players ───────────────────────────────────────────────────────────────────

@app.get("/api/players")
def get_players(_=Depends(current_user)):
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM players WHERE active=1 ORDER BY name").fetchall()]


@app.post("/api/players")
def add_player(body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute("INSERT INTO players(name) VALUES(?)", (body["name"],))
        conn.commit()
    return {"ok": True}


# ── Seasons ───────────────────────────────────────────────────────────────────

@app.get("/api/seasons")
def get_seasons(_=Depends(current_user)):
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM seasons ORDER BY year DESC").fetchall()]


@app.post("/api/seasons")
def add_season(body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute("INSERT OR IGNORE INTO seasons(year) VALUES(?)", (body["year"],))
        conn.commit()
    return {"ok": True}


# ── Weeks ─────────────────────────────────────────────────────────────────────

@app.get("/api/seasons/{season_id}/weeks")
def get_weeks(season_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM weeks WHERE season_id=? ORDER BY week_number", (season_id,)
        ).fetchall()]


class WeekBody(BaseModel):
    week_number: int
    start_date: str
    end_date: str
    league_avg_sl_plus: float = 115.0


@app.post("/api/seasons/{season_id}/weeks")
def add_week(season_id: int, body: WeekBody, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO weeks(season_id,week_number,start_date,end_date,league_avg_sl_plus) VALUES(?,?,?,?,?)",
            (season_id, body.week_number, body.start_date, body.end_date, body.league_avg_sl_plus)
        )
        conn.commit()
    return {"ok": True}


@app.patch("/api/weeks/{week_id}/league-avg")
def update_league_avg(week_id: int, body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute("UPDATE weeks SET league_avg_sl_plus=? WHERE id=?", (body["league_avg_sl_plus"], week_id))
        conn.commit()
    return {"ok": True}


# ── Games ─────────────────────────────────────────────────────────────────────

@app.get("/api/weeks/{week_id}/games")
def get_games(week_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM games WHERE week_id=? ORDER BY game_date", (week_id,)
        ).fetchall()]


@app.post("/api/weeks/{week_id}/games")
def add_game(week_id: int, body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO games(week_id,game_date,opponent) VALUES(?,?,?)",
            (week_id, body["game_date"], body.get("opponent", ""))
        )
        conn.commit()
        return {"id": cur.lastrowid}


# ── Game Events ───────────────────────────────────────────────────────────────

class ThrowEvent(BaseModel):
    player_id: int
    pop_time: Optional[float] = None
    accurate: bool = False
    exchange_error: bool = False
    back_pick: bool = False
    back_pick_base: Optional[str] = None   # '1B' | '2B' | '3B'
    bp_out: bool = False
    caught_stealing: bool = False
    throw_x: Optional[float] = None
    throw_y: Optional[float] = None
    in_dirt: bool = False
    inning: Optional[int] = None


class BlockEvent(BaseModel):
    player_id: int
    location: str  # middle | gloveside | armside
    blocked: bool = False
    passed_ball: bool = False
    wild_pitch: bool = False


class ReceivingEvent(BaseModel):
    player_id: int
    quality: str    # good | bad
    is_strike: bool = False
    pitch_x: Optional[float] = None   # 0-1 normalized (left→right from catcher view)
    pitch_y: Optional[float] = None   # 0-1 normalized (bottom→top)
    note: Optional[str] = None
    inning: Optional[int] = None


# Bulk sync endpoint for offline queues
class BulkSyncBody(BaseModel):
    throws: List[ThrowEvent] = []
    blocks: List[BlockEvent] = []
    receiving: List[ReceivingEvent] = []


@app.post("/api/games/{game_id}/throws")
def log_throw(game_id: int, body: ThrowEvent, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO throw_events(game_id,player_id,pop_time,accurate,exchange_error,back_pick,back_pick_base,bp_out,caught_stealing,throw_x,throw_y,in_dirt,inning) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (game_id, body.player_id, body.pop_time, int(body.accurate), int(body.exchange_error),
             int(body.back_pick), body.back_pick_base, int(body.bp_out), int(body.caught_stealing),
             body.throw_x, body.throw_y, int(body.in_dirt), body.inning)
        )
        conn.commit()
        return {"id": cur.lastrowid}


@app.post("/api/games/{game_id}/blocks")
def log_block(game_id: int, body: BlockEvent, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO block_events(game_id,player_id,location,blocked,passed_ball,wild_pitch) VALUES(?,?,?,?,?,?)",
            (game_id, body.player_id, body.location, int(body.blocked), int(body.passed_ball), int(body.wild_pitch))
        )
        conn.commit()
        return {"id": cur.lastrowid}


@app.post("/api/games/{game_id}/receiving")
def log_receiving(game_id: int, body: ReceivingEvent, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO receiving_events(game_id,player_id,quality,is_strike,pitch_x,pitch_y,note,inning) VALUES(?,?,?,?,?,?,?,?)",
            (game_id, body.player_id, body.quality, int(body.is_strike), body.pitch_x, body.pitch_y, body.note, body.inning)
        )
        conn.commit()
        return {"id": cur.lastrowid}


@app.post("/api/games/{game_id}/sync")
def bulk_sync(game_id: int, body: BulkSyncBody, _=Depends(current_user)):
    """Accepts a batch of queued events from offline clients."""
    ids = {"throws": [], "blocks": [], "receiving": []}
    with db.get_conn() as conn:
        for e in body.throws:
            cur = conn.execute(
                "INSERT INTO throw_events(game_id,player_id,pop_time,accurate,exchange_error,back_pick,back_pick_base,bp_out,caught_stealing) VALUES(?,?,?,?,?,?,?,?,?)",
                (game_id, e.player_id, e.pop_time, int(e.accurate), int(e.exchange_error),
                 int(e.back_pick), e.back_pick_base, int(e.bp_out), int(e.caught_stealing))
            )
            ids["throws"].append(cur.lastrowid)
        for e in body.blocks:
            cur = conn.execute(
                "INSERT INTO block_events(game_id,player_id,location,blocked,passed_ball,wild_pitch) VALUES(?,?,?,?,?,?)",
                (game_id, e.player_id, e.location, int(e.blocked), int(e.passed_ball), int(e.wild_pitch))
            )
            ids["blocks"].append(cur.lastrowid)
        for e in body.receiving:
            cur = conn.execute(
                "INSERT INTO receiving_events(game_id,player_id,quality,is_strike,pitch_x,pitch_y,note) VALUES(?,?,?,?,?,?,?)",
                (game_id, e.player_id, e.quality, int(e.is_strike), e.pitch_x, e.pitch_y, e.note)
            )
            ids["receiving"].append(cur.lastrowid)
        conn.commit()
    return ids


@app.get("/api/games/{game_id}/log")
def get_game_log(game_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        throws = [dict(r) for r in conn.execute(
            "SELECT t.*, p.name as player_name FROM throw_events t JOIN players p ON t.player_id=p.id WHERE t.game_id=? ORDER BY t.created_at DESC",
            (game_id,)
        ).fetchall()]
        blocks = [dict(r) for r in conn.execute(
            "SELECT b.*, p.name as player_name FROM block_events b JOIN players p ON b.player_id=p.id WHERE b.game_id=? ORDER BY b.created_at DESC",
            (game_id,)
        ).fetchall()]
        receiving = [dict(r) for r in conn.execute(
            "SELECT r.*, p.name as player_name FROM receiving_events r JOIN players p ON r.player_id=p.id WHERE r.game_id=? ORDER BY r.created_at DESC",
            (game_id,)
        ).fetchall()]
    return {"throws": throws, "blocks": blocks, "receiving": receiving}


@app.delete("/api/games/{game_id}/last-event")
def undo_last_event(game_id: int, event_type: str, player_id: int, _=Depends(current_user)):
    table = {"throw": "throw_events", "block": "block_events", "receiving": "receiving_events"}.get(event_type)
    if not table:
        raise HTTPException(status_code=400, detail="Invalid event type")
    with db.get_conn() as conn:
        conn.execute(
            f"DELETE FROM {table} WHERE id=(SELECT id FROM {table} WHERE game_id=? AND player_id=? ORDER BY created_at DESC LIMIT 1)",
            (game_id, player_id)
        )
        conn.commit()
    return {"ok": True}


# ── Daily Entries ─────────────────────────────────────────────────────────────

class DailyEntry(BaseModel):
    player_id: int
    entry_date: str
    liderazgo: int = 0
    practica: int = 0


@app.post("/api/daily")
def save_daily(body: DailyEntry, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO daily_entries(player_id,entry_date,liderazgo,practica) VALUES(?,?,?,?) ON CONFLICT(player_id,entry_date) DO UPDATE SET liderazgo=excluded.liderazgo, practica=excluded.practica",
            (body.player_id, body.entry_date, body.liderazgo, body.practica)
        )
        conn.commit()
    return {"ok": True}


@app.get("/api/weeks/{week_id}/daily")
def get_daily(week_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        week = conn.execute("SELECT start_date, end_date FROM weeks WHERE id=?", (week_id,)).fetchone()
        if not week:
            return []
        return [dict(r) for r in conn.execute(
            "SELECT de.*, p.name as player_name FROM daily_entries de JOIN players p ON de.player_id=p.id WHERE de.entry_date BETWEEN ? AND ? ORDER BY de.entry_date, p.name",
            (week["start_date"], week["end_date"])
        ).fetchall()]


# ── SL+ ───────────────────────────────────────────────────────────────────────

class SLEntry(BaseModel):
    player_id: int
    sl_plus: Optional[float] = None
    shadow_strike_pct: Optional[float] = None
    lg_rank: Optional[str] = None


@app.post("/api/weeks/{week_id}/sl")
def save_sl(week_id: int, body: SLEntry, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO weekly_sl(week_id,player_id,sl_plus,shadow_strike_pct,lg_rank) VALUES(?,?,?,?,?) ON CONFLICT(week_id,player_id) DO UPDATE SET sl_plus=excluded.sl_plus, shadow_strike_pct=excluded.shadow_strike_pct, lg_rank=excluded.lg_rank",
            (week_id, body.player_id, body.sl_plus,
             body.shadow_strike_pct / 100 if body.shadow_strike_pct else None,
             body.lg_rank)
        )
        conn.commit()
    return {"ok": True}


@app.get("/api/weeks/{week_id}/sl")
def get_sl(week_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT ws.*, p.name as player_name FROM weekly_sl ws JOIN players p ON ws.player_id=p.id WHERE ws.week_id=?",
            (week_id,)
        ).fetchall()]


# ── Leaderboards ──────────────────────────────────────────────────────────────

@app.get("/api/weeks/{week_id}/leaderboard")
def week_leaderboard(week_id: int, _=Depends(current_user)):
    return sc.calc_week_scores(week_id)


@app.get("/api/seasons/{season_id}/leaderboard")
def season_leaderboard(season_id: int, _=Depends(current_user)):
    return sc.calc_season_scores(season_id)


# ── Player history ────────────────────────────────────────────────────────────

@app.get("/api/players/{player_id}/history/{season_id}")
def player_history(player_id: int, season_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        weeks = conn.execute("SELECT * FROM weeks WHERE season_id=? ORDER BY week_number", (season_id,)).fetchall()
    rows = []
    for w in weeks:
        for s in sc.calc_week_scores(w["id"]):
            if s["player_id"] == player_id:
                rows.append({**s, "week_number": w["week_number"], "start_date": w["start_date"]})
    return rows


# ── Videos ────────────────────────────────────────────────────────────────────

class VideoBody(BaseModel):
    player_id: int
    title: str
    session_date: str
    session_type: str = "practice"
    video_url: str
    notes: Optional[str] = None


@app.post("/api/videos")
def add_video(body: VideoBody, _=Depends(current_user)):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO videos(player_id,title,session_date,session_type,video_url,notes) VALUES(?,?,?,?,?,?)",
            (body.player_id, body.title, body.session_date, body.session_type, body.video_url, body.notes)
        )
        conn.commit()
    return {"ok": True}


@app.get("/api/players/{player_id}/videos")
def get_videos(player_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute(
            "SELECT * FROM videos WHERE player_id=? ORDER BY session_date DESC", (player_id,)
        ).fetchall()]


# ── Serve React frontend in production ───────────────────────────────────────

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(frontend_dist / "index.html")
