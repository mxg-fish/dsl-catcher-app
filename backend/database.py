"""PostgreSQL database for DSL Catcher Tracker."""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL")

CATCHERS = [
    "Moises Morales", "Diego Martinez",
    "Francisco Del Campo", "Carlos Martinez", "Daniel Pire",
    "Yendi Pirela", "Eliecer Mendoza", "Alexander Requena",
]


@contextmanager
def get_conn():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'coach'
        );
        CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS seasons (
            id SERIAL PRIMARY KEY,
            year INTEGER NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS weeks (
            id SERIAL PRIMARY KEY,
            season_id INTEGER NOT NULL REFERENCES seasons(id),
            week_number INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            league_avg_sl_plus REAL DEFAULT 115,
            UNIQUE(season_id, week_number)
        );
        CREATE TABLE IF NOT EXISTS games (
            id SERIAL PRIMARY KEY,
            week_id INTEGER NOT NULL REFERENCES weeks(id),
            game_date TEXT NOT NULL,
            opponent TEXT
        );
        CREATE TABLE IF NOT EXISTS throw_events (
            id SERIAL PRIMARY KEY,
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
            throw_type TEXT DEFAULT 'game',
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS block_events (
            id SERIAL PRIMARY KEY,
            game_id INTEGER NOT NULL REFERENCES games(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            location TEXT NOT NULL,
            blocked INTEGER NOT NULL DEFAULT 0,
            passed_ball INTEGER NOT NULL DEFAULT 0,
            wild_pitch INTEGER NOT NULL DEFAULT 0,
            is_pick INTEGER NOT NULL DEFAULT 0,
            block_x REAL,
            block_y REAL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS receiving_events (
            id SERIAL PRIMARY KEY,
            game_id INTEGER NOT NULL REFERENCES games(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            quality TEXT NOT NULL,
            is_strike INTEGER NOT NULL DEFAULT 0,
            pitch_x REAL,
            pitch_y REAL,
            note TEXT,
            inning INTEGER,
            pitcher_hand TEXT,
            pitch_type TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS daily_entries (
            id SERIAL PRIMARY KEY,
            player_id INTEGER NOT NULL REFERENCES players(id),
            entry_date TEXT NOT NULL,
            liderazgo INTEGER NOT NULL DEFAULT 0,
            practica INTEGER NOT NULL DEFAULT 0,
            UNIQUE(player_id, entry_date)
        );
        CREATE TABLE IF NOT EXISTS weekly_sl (
            id SERIAL PRIMARY KEY,
            week_id INTEGER NOT NULL REFERENCES weeks(id),
            player_id INTEGER NOT NULL REFERENCES players(id),
            sl_plus REAL,
            shadow_strike_pct REAL,
            lg_rank TEXT,
            UNIQUE(week_id, player_id)
        );
        CREATE TABLE IF NOT EXISTS videos (
            id SERIAL PRIMARY KEY,
            player_id INTEGER NOT NULL REFERENCES players(id),
            title TEXT NOT NULL,
            session_date TEXT NOT NULL,
            session_type TEXT,
            video_url TEXT,
            notes TEXT,
            uploaded_at TIMESTAMP DEFAULT NOW()
        );
        """)
        cur.execute("""ALTER TABLE games ADD COLUMN IF NOT EXISTS completed INTEGER NOT NULL DEFAULT 0""")

        cur.execute("INSERT INTO seasons(year) VALUES(2026) ON CONFLICT DO NOTHING")
        for name in CATCHERS:
            cur.execute("INSERT INTO players(name) VALUES(%s) ON CONFLICT DO NOTHING", (name,))
