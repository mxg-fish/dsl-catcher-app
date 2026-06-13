from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from database import get_conn
import os

SECRET_KEY = os.getenv("SECRET_KEY", "dsl-marlins-secret-change-in-prod-2025")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def get_user(username: str) -> Optional[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE username=%s", (username,))
        row = cur.fetchone()
        return dict(row) if row else None


def authenticate(username: str, password: str) -> Optional[dict]:
    user = get_user(username)
    if user and verify_password(password, user["hashed_password"]):
        return user
    return None


def create_user(username: str, password: str, role: str = "coach"):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users(username, hashed_password, role) VALUES(%s,%s,%s)",
            (username, hash_password(password), role)
        )


def ensure_default_admin():
    """Create default admin account if no users exist."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM users")
        row = cur.fetchone()
        if row["count"] == 0:
            create_user("admin", "Marlins2026", "admin")
            print("Default admin created: admin / Marlins2026")