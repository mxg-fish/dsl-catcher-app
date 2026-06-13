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
