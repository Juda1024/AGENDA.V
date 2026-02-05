from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple

DB_PATH = Path("data/app.db")
UPLOADS_DIR = Path("data/uploads")
COVERS_DIR = UPLOADS_DIR / "covers"
PHOTOS_DIR = UPLOADS_DIR / "photos"

def ensure_dirs() -> None:
    for p in [DB_PATH.parent, UPLOADS_DIR, COVERS_DIR, PHOTOS_DIR]:
        p.mkdir(parents=True, exist_ok=True)

def get_conn() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(DB_PATH.as_posix(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        location TEXT,
        link TEXT,
        cover_path TEXT,
        status TEXT NOT NULL DEFAULT 'planned', -- planned | done
        created_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        rating INTEGER,
        review_text TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(event_id, username),
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        photo_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    )
    """)

    conn.commit()
    conn.close()

def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"

def save_uploaded_file(dst_path: Path, file_bytes: bytes) -> str:
    ensure_dirs()
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    dst_path.write_bytes(file_bytes)
    return dst_path.as_posix()

def create_event(title: str, location: str, link: str, cover_path: Optional[str]) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO events (title, location, link, cover_path, status, created_at) VALUES (?, ?, ?, ?, 'planned', ?)",
        (title.strip(), location.strip(), link.strip(), cover_path, now_iso())
    )
    conn.commit()
    event_id = int(cur.lastrowid)
    conn.close()
    return event_id

def list_events(status: Optional[str] = None) -> List[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    if status:
        cur.execute("SELECT * FROM events WHERE status = ? ORDER BY created_at DESC", (status,))
    else:
        cur.execute("SELECT * FROM events ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    return rows

def get_event(event_id: int) -> Optional[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    row = cur.fetchone()
    conn.close()
    return row

def set_event_status(event_id: int, status: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE events SET status = ? WHERE id = ?", (status, event_id))
    conn.commit()
    conn.close()

def upsert_review(event_id: int, username: str, rating: Optional[int], review_text: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
    INSERT INTO reviews (event_id, username, rating, review_text, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(event_id, username) DO UPDATE SET
        rating=excluded.rating,
        review_text=excluded.review_text,
        created_at=excluded.created_at
    """, (event_id, username, rating, review_text.strip(), now_iso()))
    conn.commit()
    conn.close()

def get_reviews(event_id: int) -> List[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM reviews WHERE event_id = ? ORDER BY created_at DESC", (event_id,))
    rows = cur.fetchall()
    conn.close()
    return rows

def add_photo(event_id: int, username: str, photo_path: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO photos (event_id, username, photo_path, created_at) VALUES (?, ?, ?, ?)",
        (event_id, username, photo_path, now_iso())
    )
    conn.commit()
    conn.close()

def get_photos(event_id: int) -> List[sqlite3.Row]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM photos WHERE event_id = ? ORDER BY created_at DESC", (event_id,))
    rows = cur.fetchall()
    conn.close()
    return rows

def delete_event(event_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()
