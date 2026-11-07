"""MySQL transactions and stored quiz snapshots."""

from contextlib import contextmanager
from dataclasses import asdict
import json
import pymysql
from pymysql.cursors import DictCursor

from .quiz import Item

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        operation VARCHAR(16) NOT NULL,
        join_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
        owner_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        core JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    """CREATE TABLE IF NOT EXISTS attempts (
        id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
        session_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        guest_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        nickname VARCHAR(60) NOT NULL,
        submitted TINYINT NOT NULL DEFAULT 0,
        created_order BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
        INDEX attempts_by_session (session_id, submitted, created_order),
        FOREIGN KEY (session_id) REFERENCES sessions (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    """CREATE TABLE IF NOT EXISTS turns (
        attempt_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        `position` TINYINT UNSIGNED NOT NULL,
        item JSON NOT NULL,
        kind VARCHAR(16),
        option_id CHAR(1),
        PRIMARY KEY (attempt_id, `position`),
        FOREIGN KEY (attempt_id) REFERENCES attempts (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
)


def pack_item(item):
    return json.dumps(asdict(item), separators=(",", ":"))


def unpack_item(payload):
    item = json.loads(payload)
    item["options"] = tuple(item["options"])
    return Item(**item)


def core_item(session, index):
    return unpack_item(json.loads(session["core"])[index])


def answered_turns(turns):
    history = []
    for turn in turns:
        if turn["kind"] is None:
            continue
        item = unpack_item(turn["item"])
        value = item.options[int(turn["option_id"])] if turn["kind"] == "selected" else None
        history.append((item, turn["kind"], value))
    return history


class Database:
    def __init__(self, config):
        self.config = config
        with self.transaction(write=True) as store:
            for statement in SCHEMA:
                store.execute(statement)

    @contextmanager
    def transaction(self, *, write=False):
        with pymysql.connect(**self.config, charset="utf8mb4", cursorclass=DictCursor,
                             connect_timeout=5, autocommit=False) as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("START TRANSACTION" if write else "START TRANSACTION READ ONLY")
                yield QuizStore(connection)
                connection.commit()
            except BaseException:
                connection.rollback()
                raise


class QuizStore:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, values=()):
        with self.connection.cursor() as cursor:
            cursor.execute(sql, values)

    def fetch_one(self, sql, values):
        with self.connection.cursor() as cursor:
            cursor.execute(sql, values)
            return cursor.fetchone()

    def fetch_all(self, sql, values):
        with self.connection.cursor() as cursor:
            cursor.execute(sql, values)
            return cursor.fetchall()

    def create_session(self, session_id, operation, join_hash, owner_hash, core):
        payload = json.dumps([pack_item(item) for item in core])
        self.execute(
            "INSERT INTO sessions (id, operation, join_hash, owner_hash, core) VALUES (%s, %s, %s, %s, %s)",
            (session_id, operation, join_hash, owner_hash, payload),
        )

    def session(self, session_id):
        return self.fetch_one("SELECT * FROM sessions WHERE id = %s", (session_id,))

    def session_for_link(self, join_hash):
        return self.fetch_one("SELECT * FROM sessions WHERE join_hash = %s", (join_hash,))

    def create_attempt(self, attempt_id, session_id, guest_hash, nickname):
        self.execute(
            "INSERT INTO attempts (id, session_id, guest_hash, nickname) VALUES (%s, %s, %s, %s)",
            (attempt_id, session_id, guest_hash, nickname),
        )

    def attempt(self, attempt_id, *, lock=False):
        # Answer and finish lock the same attempt before reading its turns.
        sql = "SELECT * FROM attempts WHERE id = %s"
        if lock:
            sql += " FOR UPDATE"
        return self.fetch_one(sql, (attempt_id,))

    def submitted_attempts(self, session_id):
        return self.fetch_all(
            "SELECT * FROM attempts WHERE session_id = %s AND submitted = 1 ORDER BY created_order",
            (session_id,),
        )

    def turns(self, attempt_id):
        return self.fetch_all(
            "SELECT * FROM turns WHERE attempt_id = %s ORDER BY `position`", (attempt_id,)
        )

    def add_turn(self, attempt_id, position, item):
        self.execute(
            "INSERT INTO turns (attempt_id, `position`, item) VALUES (%s, %s, %s)",
            (attempt_id, position, pack_item(item)),
        )

    def answer_turn(self, attempt_id, position, kind, option_id):
        self.execute(
            "UPDATE turns SET kind = %s, option_id = %s WHERE attempt_id = %s AND `position` = %s",
            (kind, option_id, attempt_id, position),
        )

    def submit_attempt(self, attempt_id):
        self.execute("UPDATE attempts SET submitted = 1 WHERE id = %s", (attempt_id,))
