"""Flask API for local Kirana quiz sessions."""

from hashlib import sha256
from io import BytesIO
import os
from pathlib import Path
import random
import secrets
from urllib.parse import urlsplit

from flask import Flask, abort, jsonify, request
import segno
from werkzeug.exceptions import HTTPException

from ml.diagnosis import diagnose, load_model
from ml.paths import ARTIFACT

from .quiz import CATALOG, CORE_SIZE, QUIZ_SIZE, RESPONSE_KINDS, gather_evidence, read_bank, seed_for
from .settings import database_settings
from .storage import Database, answered_turns, core_item, unpack_item


def digest(value):
    return sha256(value.encode()).hexdigest()


def authorized(expected):
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token or not secrets.compare_digest(digest(token), expected):
        abort(401, "Token akses tidak valid.")


def body():
    data = request.get_json()
    if not isinstance(data, dict):
        abort(400, "Kirim objek JSON.")
    return data


def frontend_url(value):
    url = urlsplit(value)
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username
            or url.password or url.query or url.fragment):
        raise ValueError("KIRANA_FRONTEND_URL harus berupa alamat dasar HTTP(S).")
    return value.rstrip("/")


def qr_svg(url):
    output = BytesIO()
    segno.make_qr(url, error="m").save(output, kind="svg", scale=4, xmldecl=False)
    return output.getvalue().decode("utf-8")


def get_session(store, session_id):
    row = store.session(session_id)
    if row is None:
        abort(404, "Sesi tidak ditemukan.")
    return row


def get_join_session(store, token):
    row = store.session_for_link(digest(token))
    if row is None:
        abort(404, "Tautan sesi tidak ditemukan.")
    return row


def get_student_attempt(store, attempt_id, *, lock=False):
    row = store.attempt(attempt_id, lock=lock)
    if row is None:
        abort(404, "Peserta tidak ditemukan.")
    authorized(row["guest_hash"])
    return row


def next_question(store, banks, attempt, position):
    session = get_session(store, attempt["session_id"])
    if position < CORE_SIZE:
        return core_item(session, position)

    attempt_id = attempt["id"]
    operation = session["operation"]
    history = answered_turns(store.turns(attempt_id))
    evidence = gather_evidence(operation, history)
    used = {item.family for item, _, _ in history}
    rng = random.Random(seed_for(seed_for("tail", attempt_id), position + 1))
    return banks["train", operation].next_item(used, evidence, rng)


def create_app(config=None, banks=None):
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE=database_settings(),
        FRONTEND_URL=os.environ.get("KIRANA_FRONTEND_URL", "http://localhost:5173"),
        MODEL_PATH=os.environ.get("KIRANA_MODEL_PATH", ARTIFACT),
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    app.config.update(config or {})
    base_url = frontend_url(app.config["FRONTEND_URL"])
    banks = banks if banks is not None else read_bank()
    database = Database(app.config["DATABASE"])
    model = None
    if app.config["MODEL_PATH"] and Path(app.config["MODEL_PATH"]).is_file():
        try:
            model = load_model(app.config["MODEL_PATH"])
        except (OSError, ValueError, KeyError, TypeError, EOFError):
            app.logger.exception("Artefak diagnosis tidak dapat dimuat.")

    @app.errorhandler(HTTPException)
    def http_error(error):
        response = error.get_response()
        response.set_data(app.json.dumps({"error": error.name, "message": error.description}))
        response.mimetype = "application/json"
        return response

    @app.after_request
    def prevent_caching(response):
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    def health():
        return {"status": "ok", "diagnosis_available": model is not None}

    @app.post("/api/sessions")
    def create_session():
        operation = body().get("operation")
        if not isinstance(operation, str) or operation not in CATALOG:
            abort(400, "Pilih addition atau subtraction.")
        session_id, join_token, owner_token = (secrets.token_urlsafe(24) for _ in range(3))
        bank = banks["train", operation]
        core = bank.core(random.Random(seed_for("core", session_id)))
        join_url = f"{base_url}/join/{join_token}"
        qr = qr_svg(join_url)
        with database.transaction(write=True) as store:
            store.create_session(session_id, operation, digest(join_token), digest(owner_token), core)
        return jsonify(session_id=session_id, operation=operation, question_count=QUIZ_SIZE,
                       join_url=join_url, join_qr_svg=qr, teacher_token=owner_token), 201

    @app.get("/api/join/<token>")
    def join_details(token):
        with database.transaction() as store:
            row = get_join_session(store, token)
        return {"operation": row["operation"], "question_count": QUIZ_SIZE}

    @app.post("/api/join/<token>")
    def join(token):
        name = body().get("nickname")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
            abort(400, "Nama panggilan harus berisi 1–60 karakter.")
        attempt_id, guest_token = (secrets.token_urlsafe(24) for _ in range(2))
        with database.transaction(write=True) as store:
            row = get_join_session(store, token)
            store.create_attempt(attempt_id, row["id"], digest(guest_token), name.strip())
            first = core_item(row, 0)
            store.add_turn(attempt_id, 1, first)
        return jsonify(attempt_id=attempt_id, student_token=guest_token, operation=row["operation"],
                       question_count=QUIZ_SIZE, question=first.public(1)), 201

    @app.get("/api/attempts/<attempt_id>/current")
    def current(attempt_id):
        with database.transaction() as store:
            row = get_student_attempt(store, attempt_id)
            latest = store.turns(attempt_id)[-1]
        question = unpack_item(latest["item"]).public(latest["position"]) if latest["kind"] is None else None
        return {"question": question, "ready_to_finish": question is None and not row["submitted"],
                "submitted": bool(row["submitted"])}

    @app.put("/api/attempts/<attempt_id>/responses/<int:position>")
    def answer(attempt_id, position):
        payload = body()
        kind, option_id = payload.get("kind"), payload.get("option_id")
        if kind not in RESPONSE_KINDS or (kind == "selected" and option_id not in ("0", "1", "2", "3")):
            abort(400, "Respons atau ID opsi tidak valid.")
        if kind != "selected" and option_id is not None:
            abort(400, "ID opsi hanya berlaku untuk pilihan angka.")

        with database.transaction(write=True) as store:
            row = get_student_attempt(store, attempt_id, lock=True)
            turns = store.turns(attempt_id)
            if not 1 <= position <= len(turns):
                abort(409, "Soal ini belum tersedia.")
            turn = turns[position - 1]
            if turn["kind"] is not None:
                if (turn["kind"], turn["option_id"]) != (kind, option_id):
                    abort(409, "Soal ini sudah dijawab.")
                following = unpack_item(turns[position]["item"]) if position < QUIZ_SIZE else None
            else:
                store.answer_turn(attempt_id, position, kind, option_id)
                following = None
                if position < QUIZ_SIZE:
                    following = next_question(store, banks, row, position)
                    store.add_turn(attempt_id, position + 1, following)
        return {"accepted_position": position,
                "question": following.public(position + 1) if following else None,
                "ready_to_finish": position == QUIZ_SIZE}

    @app.post("/api/attempts/<attempt_id>/finish")
    def finish(attempt_id):
        with database.transaction(write=True) as store:
            get_student_attempt(store, attempt_id, lock=True)
            if len(answered_turns(store.turns(attempt_id))) != QUIZ_SIZE:
                abort(409, "Selesaikan 15 soal terlebih dahulu.")
            store.submit_attempt(attempt_id)
        return {"submitted": True}

    @app.get("/api/sessions/<session_id>/results")
    def results(session_id):
        with database.transaction() as store:
            quiz = get_session(store, session_id)
            authorized(quiz["owner_hash"])
            operation = quiz["operation"]
            histories = [(row, answered_turns(store.turns(row["id"]))) for row in store.submitted_attempts(session_id)]
        reports = []
        for row, history in histories:
            evidence = gather_evidence(operation, history)
            reports.append({
                "attempt_id": row["id"], "nickname": row["nickname"],
                "summary": {kind: evidence.counts[kind] for kind in ("correct", "wrong", "outside_options", "skipped")},
                "diagnosis": diagnose(operation, evidence, history, model),
            })
        return {"session_id": session_id, "operation": operation, "results": reports}

    return app


def main():
    create_app().run(host="127.0.0.1", port=int(os.environ.get("KIRANA_FLASK_PORT", "5000")), load_dotenv=False)
