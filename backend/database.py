"""PostgreSQL database for DSL Catcher Tracker."""

import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL")

CATCHERS = [
    "Moises Morales", "Kevin Robledo", "Diego Martinez",
    "Francisco Del Campo", "Carlos Martinez", "Daniel Pire",
    "Yendi Pirela", "Eliecer Mendoza", "Alexander Requena",
]


@contextmanager
def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
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

        CREATE
