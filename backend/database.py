"""SQLite database for DSL Catcher Tracker (swappable to Postgres via DATABASE_URL)."""

import os, sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "catchers.db"

CATCHERS = [
    "Moises Morales", "Kevin Robledo", "Diego Martinez",
    "Francisco Del Campo", "Carlos Martinez", "Daniel Pire",
    "Yendi Pirela", "Eliecer Mendoza", "Alexander Requena",
]


def get_conn():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'coach'
        );

        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS weeks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season_id INTEGER NOT NULL REFERENCES seasons(id),
            week_number INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            league_avg_sl_plus REAL DEFAULT 115,
            UNIQUE(season_id, week_number)
        );

        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_id INTEGER NOT NULL REFERENCES weeks(id),
            game_date TEXT NOT NULL,
            opponent TEXT
        );

        CREATE TABLE IF NOT EXISTS throw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            pop_time REAL,
            accurate INTEGER NOT NULL DEFAULT 0,
            exchange_error INTEGER NOT NULL DEFAULT 0,
            back_pick INTEGER NOT NULL DEFAULT 0,
            back_pick_base TEXT,
            bp_out INTEGER NOT NULL DEFAULT 0,
            caught_stealing INTEGER NOT NULL DEFAULT 0,
            throw_x REAL,
            throw_y REAL,
            in_dirt INTEGER NOT NULL DEFAULT 0,
            inning INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS block_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            location TEXT NOT NULL CHECK(location IN ('middle','gloveside','armside')),
            blocked INTEGER NOT NULL DEFAULT 0,
            passed_ball INTEGER NOT NULL DEFAULT 0,
            wild_pitch INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS receiving_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL REFERENCES games(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            quality TEXT NOT NULL CHECK(quality IN ('good','bad')),
            is_strike INTEGER NOT NULL DEFAULT 0,
            pitch_x REAL,
            pitch_y REAL,
            note TEXT,
            inning INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS daily_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL REFERENCES players(id),
            entry_date TEXT NOT NULL,
            liderazgo INTEGER NOT NULL DEFAULT 0,
            practica INTEGER NOT NULL DEFAULT 0,
            UNIQUE(player_id, entry_date)
        );

        CREATE TABLE IF NOT EXISTS weekly_sl (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_id INTEGER NOT NULL REFERENCES weeks(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            sl_plus REAL,
            shadow_strike_pct REAL,
            lg_rank TEXT,
            UNIQUE(week_id, player_id)
        );

        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL REFERENCES players(id),
            title TEXT NOT NULL,
            session_date TEXT NOT NULL,
            session_type TEXT CHECK(session_type IN ('game','practice','bullpen','other')),
            video_url TEXT,
            notes TEXT,
            uploaded_at TEXT DEFAULT (datetime('now'))
        );
        """)

        # Migrations for existing databases
        cols = [r[1] for r in conn.execute("PRAGMA table_info(throw_events)").fetchall()]
        if "back_pick_base" not in cols:
            conn.execute("ALTER TABLE throw_events ADD COLUMN back_pick_base TEXT")
        conn.commit()
        cols = [r[1] for r in conn.execute("PRAGMA table_info(block_events)").fetchall()]
        if "is_pick" not in cols:
            conn.execute("ALTER TABLE block_events ADD COLUMN is_pick INTEGER NOT NULL DEFAULT 0")
        if "block_x" not in cols:
            conn.execute("ALTER TABLE block_events ADD COLUMN block_x REAL")
        if "block_y" not in cols:
            conn.execute("ALTER TABLE block_events ADD COLUMN block_y REAL")
        conn.commit()
        cols = [r[1] for r in conn.execute("PRAGMA table_info(receiving_events)").fetchall()]
        if "pitcher_hand" not in cols:
            conn.execute("ALTER TABLE receiving_events ADD COLUMN pitcher_hand TEXT")
        if "pitch_type" not in cols:
            conn.execute("ALTER TABLE receiving_events ADD COLUMN pitch_type TEXT")
        conn.commit()

        # Seed season and players
        conn.execute("INSERT OR IGNORE INTO seasons(year) VALUES(2026)")
        for name in CATCHERS:
            conn.execute("INSERT OR IGNORE INTO players(name) VALUES(?)", (name,))
        conn.commit()
