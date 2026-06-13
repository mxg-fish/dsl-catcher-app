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
        cur = conn.cursor()
        cur.execute("SELECT * FROM players WHERE active=1 ORDER BY name")
        return [dict(r) for r in cur.fetchall()]


@app.post("/api/players")
def add_player(body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("INSERT INTO players(name) VALUES(%s)", (body["name"],))
    return {"ok": True}


# ── Seasons ───────────────────────────────────────────────────────────────────

@app.get("/api/seasons")
def get_seasons(_=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM seasons ORDER BY year DESC")
        return [dict(r) for r in cur.fetchall()]


@app.post("/api/seasons")
def add_season(body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("INSERT INTO seasons(year) VALUES(%s) ON CONFLICT DO NOTHING", (body["year"],))
    return {"ok": True}


# ── Weeks ─────────────────────────────────────────────────────────────────────

@app.get("/api/seasons/{season_id}/weeks")
def get_weeks(season_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM weeks WHERE season_id=%s ORDER BY week_number", (season_id,))
        return [dict(r) for r in cur.fetchall()]


class WeekBody(BaseModel):
    week_number: int
    start_date: str
    end_date: str
    league_avg_sl_plus: float = 115.0


@app.post("/api/seasons/{season_id}/weeks")
def add_week(season_id: int, body: WeekBody, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO weeks(season_id,week_number,start_date,end_date,league_avg_sl_plus) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(season_id,week_number) DO UPDATE SET start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, league_avg_sl_plus=EXCLUDED.league_avg_sl_plus",
            (season_id, body.week_number, body.start_date, body.end_date, body.league_avg_sl_plus)
        )
    return {"ok": True}


@app.patch("/api/weeks/{week_id}/league-avg")
def update_league_avg(week_id: int, body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE weeks SET league_avg_sl_plus=%s WHERE id=%s", (body["league_avg_sl_plus"], week_id))
    return {"ok": True}


# ── Games ─────────────────────────────────────────────────────────────────────

@app.get("/api/weeks/{week_id}/games")
def get_games(week_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM games WHERE week_id=%s ORDER BY game_date", (week_id,))
        return [dict(r) for r in cur.fetchall()]


@app.post("/api/weeks/{week_id}/games")
def add_game(week_id: int, body: dict, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO games(week_id,game_date,opponent) VALUES(%s,%s,%s) RETURNING id",
            (week_id, body["game_date"], body.get("opponent", ""))
        )
        row = cur.fetchone()
        return {"id": row["id"]}


# ── Game Events ───────────────────────────────────────────────────────────────

class ThrowEvent(BaseModel):
    player_id: int
    pop_time: Optional[float] = None
    accurate: bool = False
    exchange_error: bool = False
    back_pick: bool = False
    back_pick_base: Optional[str] = None
    bp_out: bool = False
    caught_stealing: bool = False
    throw_x: Optional[float] = None
    throw_y: Optional[float] = None
    in_dirt: bool = False
    inning: Optional[int] = None
    throw_type: Optional[str] = 'game'


class BlockEvent(BaseModel):
    player_id: int
    location: str
    blocked: bool = False
    passed_ball: bool = False
    wild_pitch: bool = False
    is_pick: bool = False
    block_x: Optional[float] = None
    block_y: Optional[float] = None


class ReceivingEvent(BaseModel):
    player_id: int
    quality: str
    is_strike: bool = False
    pitch_x: Optional[float] = None
    pitch_y: Optional[float] = None
    note: Optional[str] = None
    inning: Optional[int] = None
    pitcher_hand: Optional[str] = None
    pitch_type: Optional[str] = None


class BulkSyncBody(BaseModel):
    throws: List[ThrowEvent] = []
    blocks: List[BlockEvent] = []
    receiving: List[ReceivingEvent] = []


@app.post("/api/games/{game_id}/throws")
def log_throw(game_id: int, body: ThrowEvent, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO throw_events(game_id,player_id,pop_time,accurate,exchange_error,back_pick,back_pick_base,bp_out,caught_stealing,throw_x,throw_y,in_dirt,inning,throw_type) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (game_id, body.player_id, body.pop_time, int(body.accurate), int(body.exchange_error),
             int(body.back_pick), body.back_pick_base, int(body.bp_out), int(body.caught_stealing),
             body.throw_x, body.throw_y, int(body.in_dirt), body.inning, body.throw_type)
        )
        row = cur.fetchone()
        return {"id": row["id"]}


@app.post("/api/games/{game_id}/blocks")
def log_block(game_id: int, body: BlockEvent, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO block_events(game_id,player_id,location,blocked,passed_ball,wild_pitch,is_pick,block_x,block_y) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (game_id, body.player_id, body.location, int(body.blocked), int(body.passed_ball),
             int(body.wild_pitch), int(body.is_pick), body.block_x, body.block_y)
        )
        row = cur.fetchone()
        return {"id": row["id"]}


@app.post("/api/games/{game_id}/receiving")
def log_receiving(game_id: int, body: ReceivingEvent, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO receiving_events(game_id,player_id,quality,is_strike,pitch_x,pitch_y,note,inning,pitcher_hand,pitch_type) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (game_id, body.player_id, body.quality, int(body.is_strike), body.pitch_x, body.pitch_y,
             body.note, body.inning, body.pitcher_hand, body.pitch_type)
        )
        row = cur.fetchone()
        return {"id": row["id"]}


@app.post("/api/games/{game_id}/sync")
def bulk_sync(game_id: int, body: BulkSyncBody, _=Depends(current_user)):
    ids = {"throws": [], "blocks": [], "receiving": []}
    with db.get_conn() as conn:
        cur = conn.cursor()
        for e in body.throws:
            cur.execute(
                "INSERT INTO throw_events(game_id,player_id,pop_time,accurate,exchange_error,back_pick,back_pick_base,bp_out,caught_stealing) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (game_id, e.player_id, e.pop_time, int(e.accurate), int(e.exchange_error),
                 int(e.back_pick), e.back_pick_base, int(e.bp_out), int(e.caught_stealing))
            )
            ids["throws"].append(cur.fetchone()["id"])
        for e in body.blocks:
            cur.execute(
                "INSERT INTO block_events(game_id,player_id,location,blocked,passed_ball,wild_pitch) VALUES(%s,%s,%s,%s,%s,%s) RETURNING id",
                (game_id, e.player_id, e.location, int(e.blocked), int(e.passed_ball), int(e.wild_pitch))
            )
            ids["blocks"].append(cur.fetchone()["id"])
        for e in body.receiving:
            cur.execute(
                "INSERT INTO receiving_events(game_id,player_id,quality,is_strike,pitch_x,pitch_y,note) VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (game_id, e.player_id, e.quality, int(e.is_strike), e.pitch_x, e.pitch_y, e.note)
            )
            ids["receiving"].append(cur.fetchone()["id"])
    return ids


@app.get("/api/games/{game_id}/log")
def get_game_log(game_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT t.*, p.name as player_name FROM throw_events t JOIN players p ON t.player_id=p.id WHERE t.game_id=%s ORDER BY t.created_at DESC",
            (game_id,)
        )
        throws = [dict(r) for r in cur.fetchall()]
        cur.execute(
            "SELECT b.*, p.name as player_name FROM block_events b JOIN players p ON b.player_id=p.id WHERE b.game_id=%s ORDER BY b.created_at DESC",
            (game_id,)
        )
        blocks = [dict(r) for r in cur.fetchall()]
        cur.execute(
            "SELECT r.*, p.name as player_name FROM receiving_events r JOIN players p ON r.player_id=p.id WHERE r.game_id=%s ORDER BY r.created_at DESC",
            (game_id,)
        )
        receiving = [dict(r) for r in cur.fetchall()]
    return {"throws": throws, "blocks": blocks, "receiving": receiving}


@app.delete("/api/games/{game_id}/last-event")
def undo_last_event(game_id: int, event_type: str, player_id: int, _=Depends(current_user)):
    table = {"throw": "throw_events", "block": "block_events", "receiving": "receiving_events"}.get(event_type)
    if not table:
        raise HTTPException(status_code=400, detail="Invalid event type")
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"DELETE FROM {table} WHERE id=(SELECT id FROM {table} WHERE game_id=%s AND player_id=%s ORDER BY created_at DESC LIMIT 1)",
            (game_id, player_id)
        )
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
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO daily_entries(player_id,entry_date,liderazgo,practica) VALUES(%s,%s,%s,%s) ON CONFLICT(player_id,entry_date) DO UPDATE SET liderazgo=EXCLUDED.liderazgo, practica=EXCLUDED.practica",
            (body.player_id, body.entry_date, body.liderazgo, body.practica)
        )
    return {"ok": True}


@app.get("/api/weeks/{week_id}/daily")
def get_daily(week_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT start_date, end_date FROM weeks WHERE id=%s", (week_id,))
        week = cur.fetchone()
        if not week:
            return []
        cur.execute(
            "SELECT de.*, p.name as player_name FROM daily_entries de JOIN players p ON de.player_id=p.id WHERE de.entry_date BETWEEN %s AND %s ORDER BY de.entry_date, p.name",
            (week["start_date"], week["end_date"])
        )
        return [dict(r) for r in cur.fetchall()]


# ── SL+ ───────────────────────────────────────────────────────────────────────

class SLEntry(BaseModel):
    player_id: int
    sl_plus: Optional[float] = None
    shadow_strike_pct: Optional[float] = None
    lg_rank: Optional[str] = None


@app.post("/api/weeks/{week_id}/sl")
def save_sl(week_id: int, body: SLEntry, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO weekly_sl(week_id,player_id,sl_plus,shadow_strike_pct,lg_rank) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(week_id,player_id) DO UPDATE SET sl_plus=EXCLUDED.sl_plus, shadow_strike_pct=EXCLUDED.shadow_strike_pct, lg_rank=EXCLUDED.lg_rank",
            (week_id, body.player_id, body.sl_plus,
             body.shadow_strike_pct / 100 if body.shadow_strike_pct else None,
             body.lg_rank)
        )
    return {"ok": True}


@app.get("/api/weeks/{week_id}/sl")
def get_sl(week_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT ws.*, p.name as player_name FROM weekly_sl ws JOIN players p ON ws.player_id=p.id WHERE ws.week_id=%s",
            (week_id,)
        )
        return [dict(r) for r in cur.fetchall()]


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
        cur = conn.cursor()
        cur.execute("SELECT * FROM weeks WHERE season_id=%s ORDER BY week_number", (season_id,))
        weeks = cur.fetchall()
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
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO videos(player_id,title,session_date,session_type,video_url,notes) VALUES(%s,%s,%s,%s,%s,%s)",
            (body.player_id, body.title, body.session_date, body.session_type, body.video_url, body.notes)
        )
    return {"ok": True}


@app.get("/api/players/{player_id}/videos")
def get_videos(player_id: int, _=Depends(current_user)):
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM videos WHERE player_id=%s ORDER BY session_date DESC", (player_id,))
        return [dict(r) for r in cur.fetchall()]


# ── Serve React frontend in production ───────────────────────────────────────

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(frontend_dist / "index.html")