"""Flask API for local Kirana quiz sessions."""

from hashlib import sha256, file_digest
from io import BytesIO
import os
from pathlib import Path
import random
import secrets
import pickle
from urllib.parse import urlsplit

from flask import Flask, abort, jsonify, request
from werkzeug.security import check_password_hash
from datetime import datetime, timezone
import pymysql
import segno
from werkzeug.exceptions import HTTPException

from ml.diagnosis import diagnose, load_model, load_category_model, evidence_timeline
from ml.paths import ARTIFACT
from ml.model_bundle import DEFAULT_PATH as BUNDLE_PATH, load_bundle

from .quiz import CATEGORIES, POLICY_VERSION, category_banks, CATALOG, CORE_SIZE, QUIZ_SIZE, RESPONSE_KINDS, gather_evidence, read_bank, seed_for
from .settings import database_settings, environment
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
    key = ("train", operation, session["number_category"]) if session["number_category"] else ("train", operation)
    return banks[key].next_item(used, evidence, rng)


def create_app(config=None, banks=None):
    env = environment()
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE=database_settings(),
        FRONTEND_URL=env.get("KIRANA_FRONTEND_URL", "http://localhost:3000"),
        MODEL_PATH=env.get("KIRANA_MODEL_PATH", ARTIFACT),
        MODEL_BUNDLE_PATH=env.get("KIRANA_MODEL_BUNDLE_PATH", BUNDLE_PATH),
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    app.config.update(config or {})
    base_url = frontend_url(app.config["FRONTEND_URL"])
    banks = banks if banks is not None else read_bank()
    banks = category_banks(banks)
    database = Database(app.config["DATABASE"])
    model = category_model = None
    category_path = env.get("KIRANA_CATEGORY_MODEL_PATH", str(Path(ARTIFACT).with_name("kirana_mcq_category_v2.joblib")))
    category_path = app.config.get("CATEGORY_MODEL_PATH", category_path)
    bundle_path = app.config["MODEL_BUNDLE_PATH"]
    if bundle_path and Path(bundle_path).is_file():
        try:
            bundle = load_bundle(bundle_path)
            model, category_model = bundle["legacy"], bundle["category"]
        except (OSError, ValueError, KeyError, TypeError, EOFError, ImportError, AttributeError, pickle.UnpicklingError):
            app.logger.exception("Model gabungan tidak dapat dimuat; artefak lama tetap digunakan bila tersedia.")
        else:
            category_path = app.config["MODEL_PATH"] = bundle_path
    if model is None and app.config["MODEL_PATH"] and Path(app.config["MODEL_PATH"]).is_file():
        try:
            model = load_model(app.config["MODEL_PATH"])
        except (OSError, ValueError, KeyError, TypeError, EOFError, ImportError, AttributeError, pickle.UnpicklingError):
            app.logger.exception("Artefak diagnosis sesi lama tidak dapat dimuat.")
    if category_model is None and category_path and Path(category_path).is_file():
        try:
            category_model = load_category_model(category_path)
        except (OSError, ValueError, KeyError, TypeError, EOFError, ImportError, AttributeError, pickle.UnpicklingError):
            app.logger.exception("Artefak kategori belum dapat dimuat.")

    def fingerprint(path):
        if not path or not Path(path).is_file(): return None
        with Path(path).open("rb") as source: return file_digest(source,"sha256").hexdigest()
    model_versions = {"legacy": fingerprint(app.config["MODEL_PATH"]) if model is not None else None,
                      "category": fingerprint(category_path) if category_model is not None else None}

    def teacher(store):
        token = request.cookies.get("kirana_teacher", "")
        # Bearer tokens are exclusively for students, not an alternative teacher login.
        if request.headers.get("Authorization"):
            abort(401, "Gunakan login guru untuk membaca laporan.")
        row = store.fetch_one("""SELECT t.* FROM teachers t JOIN teacher_logins l
            ON l.teacher_id=t.id WHERE l.token_hash=%s AND l.expires_at > UTC_TIMESTAMP()""", (digest(token),))
        if row is None:
            abort(401, "Silakan masuk sebagai guru.")
        return row

    def owned(store, session_id, lock=False):
        user = teacher(store)
        row = store.fetch_one("SELECT * FROM sessions WHERE id=%s" + (" FOR UPDATE" if lock else ""), (session_id,))
        if row is None or row["teacher_id"] != user["id"]:
            abort(404, "Sesi tidak ditemukan.")
        return row

    def stamp(value):
        return value.replace(tzinfo=timezone.utc).isoformat() if value else None

    def session_view(store, row):
        counts = store.fetch_one("SELECT COUNT(*) AS participants, COALESCE(SUM(submitted),0) AS submissions FROM attempts WHERE session_id=%s", (row["id"],))
        url = f'{base_url}/join/{row["join_token"]}'
        return {"session_id": row["id"], "operation": row["operation"], "code": row["code"],
                "number_category": row["number_category"], "quiz_policy_version": row["quiz_policy_version"],
                "question_count": QUIZ_SIZE, "status": "closed" if row["closed_at"] else "open",
                "created_at": stamp(row["created_at"]), "closed_at": stamp(row["closed_at"]),
                "participant_count": counts["participants"], "submission_count": int(counts["submissions"]),
                "join_url": url, "join_qr_svg": qr_svg(url)}

    @app.before_request
    def same_origin_mutations():
        origin = request.headers.get("Origin")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and origin.rstrip("/") != base_url:
            abort(403, "Alamat frontend tidak diizinkan.")

    @app.errorhandler(pymysql.MySQLError)
    def database_error(error):
        app.logger.error("Database request failed: %s", type(error).__name__)
        return jsonify(error="Database unavailable", message="Database belum dapat dihubungi. Coba lagi."), 503

    @app.post("/api/auth/login")
    def login():
        payload = body()
        email, password = payload.get("email"), payload.get("password")
        if not isinstance(email, str) or not isinstance(password, str):
            abort(400, "Email dan kata sandi wajib diisi.")
        with database.transaction(write=True) as store:
            user = store.fetch_one("SELECT * FROM teachers WHERE email=%s", (email.strip().lower(),))
            if not user or not check_password_hash(user["password_hash"], password):
                abort(401, "Email atau kata sandi salah.")
            token = secrets.token_urlsafe(32)
            store.execute("DELETE FROM teacher_logins WHERE expires_at <= UTC_TIMESTAMP() OR token_hash=%s", (digest(request.cookies.get("kirana_teacher", "")),))
            store.execute("INSERT INTO teacher_logins VALUES (%s,%s,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR))", (digest(token), user["id"]))
        response = jsonify(guru={"nama": user["name"], "email": user["email"]}, masukPada=datetime.now(timezone.utc).isoformat())
        response.set_cookie("kirana_teacher", token, httponly=True, secure=base_url.startswith("https:"), samesite="Lax", max_age=43200, path="/api")
        return response

    @app.get("/api/auth/me")
    def me():
        with database.transaction() as store:
            user = teacher(store)
        return {"guru": {"nama": user["name"], "email": user["email"]}, "masukPada": datetime.now(timezone.utc).isoformat()}

    @app.post("/api/auth/logout")
    def logout():
        with database.transaction(write=True) as store:
            store.execute("DELETE FROM teacher_logins WHERE token_hash=%s", (digest(request.cookies.get("kirana_teacher", "")),))
        response = jsonify(ok=True)
        response.delete_cookie("kirana_teacher", path="/api", secure=base_url.startswith("https:"), httponly=True, samesite="Lax")
        return response

    @app.get("/api/sessions")
    def list_sessions():
        with database.transaction() as store:
            user = teacher(store)
            rows = store.fetch_all("SELECT * FROM sessions WHERE teacher_id=%s ORDER BY created_at DESC, id", (user["id"],))
            return {"sessions": [session_view(store, row) for row in rows]}

    @app.get("/api/sessions/<session_id>")
    def session_details(session_id):
        with database.transaction() as store:
            return session_view(store, owned(store, session_id))

    @app.post("/api/sessions/<session_id>/close")
    def close_session(session_id):
        with database.transaction(write=True) as store:
            owned(store, session_id, lock=True)
            store.execute("UPDATE sessions SET closed_at=COALESCE(closed_at,UTC_TIMESTAMP()) WHERE id=%s", (session_id,))
            return session_view(store, get_session(store, session_id))

    @app.post("/api/join/resolve")
    def resolve_code():
        code = body().get("code")
        if not isinstance(code, str):
            abort(400, "Masukkan kode sesi.")
        with database.transaction() as store:
            row = store.fetch_one("SELECT * FROM sessions WHERE code=%s", (code.strip().upper(),))
            if row is None:
                abort(404, "Kode sesi tidak ditemukan.")
            return {"token": row["join_token"], "code": row["code"]}

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
        return {"status": "ok", "diagnosis_available": model is not None, "category_diagnosis_available": category_model is not None}

    @app.post("/api/sessions")
    def create_session():
        payload = body()
        operation = payload.get("operation")
        category = payload.get("number_category")
        if not isinstance(category, str) or category not in CATEGORIES:
            abort(400, "Pilih kategori puluhan, ratusan, atau ribuan.")
        if not isinstance(operation, str) or operation not in CATALOG:
            abort(400, "Pilih addition atau subtraction.")
        session_id, join_token, owner_token = (secrets.token_urlsafe(24) for _ in range(3))
        bank = banks.get(("train", operation, category))
        if bank is None:
            abort(400, "Kategori ini belum memiliki 15 keluarga soal yang tersedia.")
        core = bank.core(random.Random(seed_for("core", session_id)))
        with database.transaction(write=True) as store:
            user = teacher(store)
            store.create_session(session_id, operation, digest(join_token), digest(owner_token), core)
            store.execute("UPDATE sessions SET number_category=%s, quiz_policy_version=%s WHERE id=%s", (category, POLICY_VERSION, session_id))
            for _ in range(10):
                code = "KRN-" + "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
                try:
                    store.execute("UPDATE sessions SET teacher_id=%s, join_token=%s, code=%s WHERE id=%s", (user["id"], join_token, code, session_id))
                    break
                except pymysql.IntegrityError as error:
                    if error.args[0] != 1062:
                        raise
            else:
                abort(503, "Belum dapat membuat kode. Coba lagi.")
            result = session_view(store, get_session(store, session_id))
        return jsonify(result), 201

    @app.get("/api/join/<token>")
    def join_details(token):
        with database.transaction() as store:
            row = get_join_session(store, token)
        return {"number_category": row["number_category"], "quiz_policy_version": row["quiz_policy_version"], "operation": row["operation"], "question_count": QUIZ_SIZE, "code": row["code"], "status": "closed" if row["closed_at"] else "open"}

    @app.post("/api/join/<token>")
    def join(token):
        name = body().get("nickname")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
            abort(400, "Nama panggilan harus berisi 1–60 karakter.")
        attempt_id, guest_token = (secrets.token_urlsafe(24) for _ in range(2))
        with database.transaction(write=True) as store:
            row = store.fetch_one("SELECT * FROM sessions WHERE join_hash=%s FOR UPDATE", (digest(token),))
            if row is None:
                abort(404, "Tautan sesi tidak ditemukan.")
            if row["closed_at"]:
                abort(409, "Sesi sudah ditutup untuk peserta baru.")
            store.create_attempt(attempt_id, row["id"], digest(guest_token), name.strip())
            first = core_item(row, 0)
            store.add_turn(attempt_id, 1, first)
        return jsonify(attempt_id=attempt_id, student_token=guest_token, operation=row["operation"],
                       question_count=QUIZ_SIZE, question=first.public(1)), 201

    @app.get("/api/attempts/<attempt_id>/progress")
    def progress(attempt_id):
        with database.transaction() as store:
            row = get_student_attempt(store, attempt_id)
            turns = store.turns(attempt_id)
        return {"attempt_id": row["id"], "nickname": row["nickname"], "submitted_at": stamp(row["submitted_at"]),
                "submitted": bool(row["submitted"]),
                "questions": [unpack_item(t["item"]).public(t["position"]) for t in turns],
                "responses": [{"position": t["position"], "kind": t["kind"], "option_id": t["option_id"]} for t in turns if t["kind"] is not None]}

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
    def results(session_id, detail_attempt=None):
        with database.transaction() as store:
            quiz = owned(store, session_id)
            operation = quiz["operation"]
            histories = [(row, answered_turns(store.turns(row["id"]))) for row in store.submitted_attempts(session_id) if detail_attempt is None or row["id"] == detail_attempt]
            category = quiz["number_category"]
            bank = banks.get(("train", operation, category) if category else ("train", operation))
        reports = []
        for row, history in histories:
            evidence = gather_evidence(operation, history)
            reports.append({
                "attempt_id": row["id"], "nickname": row["nickname"],
                "submitted_at": stamp(row["submitted_at"]),
                "answers": [{"position": n, "operand_1": item.a, "operand_2": item.b,
                             "correct_value": item.correct, "selected_value": value,
                             "kind": ("correct" if value == item.correct else "wrong") if kind == "selected" else kind}
                            for n, (item, kind, value) in enumerate(history, 1)],
                "summary": {kind: evidence.counts[kind] for kind in ("correct", "wrong", "outside_options", "skipped")},
                "diagnosis": diagnose(operation, evidence, history, model, category=category, bank=bank, category_model=category_model),
                "quiz_policy_version": quiz["quiz_policy_version"],
                "model_artifact_sha256": model_versions["category" if category else "legacy"],
                **({"evidence_timeline": evidence_timeline(operation, history)} if detail_attempt else {}),
            })
        return {"session_id": session_id, "operation": operation, "results": reports}

    @app.get("/api/sessions/<session_id>/results/<attempt_id>")
    def student_result(session_id, attempt_id):
        report = results(session_id, attempt_id)
        row = next((r for r in report["results"] if r["attempt_id"] == attempt_id), None)
        if row is None:
            abort(404, "Hasil siswa tidak ditemukan.")
        return row

    return app


def main():
    create_app().run(host="127.0.0.1", port=int(environment().get("KIRANA_FLASK_PORT", "5000")), load_dotenv=False)
