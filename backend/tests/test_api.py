from concurrent.futures import ThreadPoolExecutor
import os
import random
import unittest
from threading import Barrier
from urllib.parse import urlsplit

from app import create_app
from seed import seed_teacher
from backend.src.storage import Database
import secrets
import tempfile
from pathlib import Path
from backend.src.api import qr_svg
from backend.src.quiz import Evidence, QuizBank, make_item, read_bank
from backend.src.settings import database_settings
from ml.paths import ARTIFACT


def auth(token):
    return {"Authorization": f"Bearer {token}"}


class QuizPolicyTests(unittest.TestCase):
    def test_ambiguous_answer_selects_distinguishing_options(self):
        def item(a, b):
            return make_item({"question_id": f"{a}-{b}", "operation": "subtraction",
                              "operand_1": a, "operand_2": b, "correct_answer": a - b})

        first, distinguishing = item(52, 27), item(71, 38)
        evidence = Evidence("subtraction")
        self.assertIn(35, first.options)
        evidence.add(first, "selected", 35)
        self.assertEqual(evidence.shared["S1", "S2"], 1)
        bank = QuizBank("subtraction", [first, distinguishing, *(item(a, 10) for a in range(70, 84))])
        chosen = bank.next_item({first.family}, evidence, random.Random(42))
        self.assertEqual(chosen, distinguishing)
        self.assertTrue({43, 47}.issubset(chosen.options))


class QuizApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        name = os.environ.get("KIRANA_TEST_DB_NAME")
        if not name:
            raise unittest.SkipTest("Atur KIRANA_TEST_DB_NAME ke database MySQL khusus tes.")
        settings = database_settings()
        if name == settings["database"]:
            raise ValueError("Database tes harus berbeda dari KIRANA_DB_NAME.")
        cls.config = {"TESTING": True, "DATABASE": {**settings, "database": name},
                      "FRONTEND_URL": "http://192.168.1.10:5173", "MODEL_PATH": None,
                      "MODEL_BUNDLE_PATH": None}
        cls.banks = read_bank()

    def setUp(self):
        self.app = create_app(self.config, self.banks)
        self.client = self.app.test_client()
        self.email = f"test-{secrets.token_hex(8)}@kirana.local"
        self.password = secrets.token_urlsafe(20)
        seed_teacher(Database(self.config["DATABASE"]), self.email, "Guru Tes", self.password)
        response = self.client.post("/api/auth/login", json={"email": self.email, "password": self.password})
        self.assertEqual(response.status_code, 200)
        self.assertIn("HttpOnly", response.headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", response.headers["Set-Cookie"])

    def logged_in(self, config=None):
        client = create_app(config or self.config, self.banks).test_client()
        self.assertEqual(client.post("/api/auth/login", json={"email": self.email, "password": self.password}).status_code, 200)
        return client

    def create(self, operation):
        response = self.client.post("/api/sessions", json={"operation": operation, "number_category": "hundreds"})
        self.assertEqual(response.status_code, 201)
        session = response.json
        join_path = urlsplit(session["join_url"]).path
        self.assertEqual(urlsplit(session["join_url"]).netloc, "192.168.1.10:5173")
        self.assertEqual(session["join_qr_svg"], qr_svg(session["join_url"]))
        self.assertIn("<svg", session["join_qr_svg"])
        return session, f"/api{join_path}"

    def join(self, path, nickname):
        response = self.client.post(path, json={"nickname": nickname})
        self.assertEqual(response.status_code, 201)
        return response.json

    def test_complete_two_attempts_with_shared_core_and_retry(self):
        self.assertEqual(self.client.post("/api/sessions", json={"operation": "both"}).status_code, 400)
        for operation in ("addition", "subtraction"):
            with self.subTest(operation=operation):
                session, join_path = self.create(operation)
                self.assertEqual(self.client.get(join_path).json["operation"], operation)
                first = self.join(join_path, "Ayu")
                second = self.join(join_path, "Bima")
                report_path = f'/api/sessions/{session["session_id"]}/results'
                teacher = {}
                self.assertEqual(self.client.get(report_path, headers=auth(first["student_token"])).status_code, 401)
                self.assertEqual(self.client.get(report_path, headers=auth(join_path.split("/")[-1])).status_code, 401)
                self.assertEqual(self.client.get(report_path, headers=teacher).json["results"], [])
                shared = []
                for guest in (first, second):
                    headers = auth(guest["student_token"])
                    route = f'/api/attempts/{guest["attempt_id"]}'
                    self.assertEqual(self.client.post(f"{route}/finish", headers=headers).status_code, 409)
                    question = guest["question"]
                    ids = []
                    for position in range(1, 16):
                        self.assertEqual(question["position"], position)
                        self.assertEqual(question["operation"], operation)
                        self.assertEqual(len({option["value"] for option in question["options"]}), 4)
                        self.assertEqual(set(question), {"id", "position", "operation", "operand_1", "operand_2", "options"})
                        self.assertEqual(self.client.get(f"{route}/current", headers=headers).json["question"], question)
                        ids.append(question["id"])
                        if position in (1, 4):
                            a, b = question["operand_1"], question["operand_2"]
                            correct = a + b if operation == "addition" else a - b
                            value = next(x for x in question["options"] if (x["value"] == correct) == (position == 1))
                            payload = {"kind": "selected", "option_id": value["id"]}
                        else:
                            payload = {"kind": "outside_options" if position == 2 else "skipped"}
                        path = f"{route}/responses/{position}"
                        if position == 1:
                            barrier = Barrier(2, timeout=5)

                            def send_answer():
                                barrier.wait()
                                return self.app.test_client().put(path, headers=headers, json=payload)

                            with ThreadPoolExecutor(max_workers=2) as pool:
                                pending = [pool.submit(send_answer) for _ in range(2)]
                                answer, retry = [result.result() for result in pending]
                            self.assertEqual(retry.status_code, 200)
                            self.assertEqual(retry.json, answer.json)
                        else:
                            answer = self.client.put(path, headers=headers, json=payload)
                        self.assertEqual(answer.status_code, 200)
                        self.assertEqual(self.client.put(path, headers=headers, json=payload).json, answer.json)
                        if position == 1:
                            self.assertEqual(self.client.put(path, headers=headers, json={"kind": "skipped"}).status_code, 409)
                        question = answer.json["question"]
                    self.assertEqual(len(set(ids)), 15)
                    self.assertIsNone(question)
                    self.assertTrue(self.client.get(f"{route}/current", headers=headers).json["ready_to_finish"])
                    for _ in range(2):
                        self.assertEqual(self.client.post(f"{route}/finish", headers=headers).json, {"submitted": True})
                    shared.append(ids[:9])
                self.assertEqual(shared[0], shared[1])
                reopened = self.logged_in()
                results = reopened.get(report_path, headers=teacher).json["results"]
                self.assertEqual([r["nickname"] for r in results], ["Ayu", "Bima"])
                for report in results:
                    self.assertEqual(report["summary"], {"correct": 1, "wrong": 1, "outside_options": 1, "skipped": 12})
                    self.assertEqual(report["diagnosis"]["model_compatibility"], "category_model_unavailable")
                if ARTIFACT.is_file():
                    with_model = self.logged_in({**self.config, "MODEL_PATH": ARTIFACT})
                    self.assertTrue(with_model.get("/api/health").json["diagnosis_available"])
                    diagnosed = with_model.get(report_path, headers=teacher).json["results"]
                    self.assertTrue(all(row["diagnosis"]["model_compatibility"] == "category_model_unavailable" for row in diagnosed))

    def test_auth_ownership_codes_close_and_resume(self):
        outsider = self.app.test_client()
        self.assertEqual(outsider.post("/api/sessions", json={"operation": "addition", "number_category": "hundreds"}).status_code, 401)
        self.assertEqual(outsider.post("/api/auth/login", json={"email": self.email, "password": "wrong"}).status_code, 401)
        self.assertFalse(seed_teacher(Database(self.config["DATABASE"]), self.email, "Changed", "changed-password"))
        session, path = self.create("addition")
        sid = session["session_id"]
        self.assertRegex(session["code"], r"^KRN-[A-HJ-NP-Z2-9]{6}$")
        resolved = outsider.post("/api/join/resolve", json={"code": session["code"]}).json
        self.assertEqual(path, "/api/join/" + resolved["token"])
        self.assertEqual(outsider.post("/api/join/resolve", json={"code": "KRN-XXXXXX"}).status_code, 404)
        other_email = f"other-{secrets.token_hex(8)}@kirana.local"
        seed_teacher(Database(self.config["DATABASE"]), other_email, "Other", self.password)
        outsider.post("/api/auth/login", json={"email": other_email, "password": self.password})
        for route in [f"/api/sessions/{sid}", f"/api/sessions/{sid}/results"]:
            self.assertEqual(outsider.get(route).status_code, 404)
        self.assertEqual(outsider.post(f"/api/sessions/{sid}/close").status_code, 404)
        guest = self.join(path, "Siswa melanjutkan")
        headers = auth(guest["student_token"])
        route = f'/api/attempts/{guest["attempt_id"]}'
        self.client.put(route + "/responses/1", headers=headers, json={"kind": "outside_options"})
        progress = self.client.get(route + "/progress", headers=headers).json
        self.assertEqual(len(progress["responses"]), 1)
        self.assertEqual(len(progress["questions"]), 2)
        self.assertNotIn("correct_value", str(progress))
        self.assertEqual(self.client.get(route + "/progress").status_code, 401)
        self.assertEqual(self.client.post(f"/api/sessions/{sid}/close").json["status"], "closed")
        self.assertEqual(self.client.post(path, json={"nickname": "Baru"}).status_code, 409)
        for n in range(2, 16):
            self.assertEqual(self.client.put(route + f"/responses/{n}", headers=headers, json={"kind": "skipped"}).status_code, 200)
        self.client.post(route + "/finish", headers=headers)
        report = self.client.get(f'/api/sessions/{sid}/results/{guest["attempt_id"]}').json
        self.assertEqual(len(report["answers"]), 15)
        self.assertIsNotNone(report["submitted_at"])
        self.assertEqual(sum(report["summary"].values()), 15)
        self.assertEqual(self.client.get(f"/api/sessions/{sid}").json["submission_count"], 1)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_migration_preserves_unowned_session_and_invalid_model(self):
        from backend.src.api import digest
        db = Database(self.config["DATABASE"])
        legacy_id = "legacy-" + secrets.token_hex(12)
        with db.transaction(write=True) as store:
            store.create_session(legacy_id, "addition", digest(legacy_id), digest("legacy-owner"),
                                 self.banks["train", "addition"].core(random.Random(24)))
        migrated = Database(self.config["DATABASE"])
        with migrated.transaction() as store:
            self.assertIsNotNone(store.session(legacy_id))
            self.assertIsNone(store.session(legacy_id)["teacher_id"])
        self.assertEqual(self.client.get(f"/api/sessions/{legacy_id}").status_code, 404)
        with tempfile.TemporaryDirectory() as folder:
            artifact = Path(folder) / "invalid.joblib"
            artifact.write_bytes(b"not-a-model")
            with self.assertLogs(level="ERROR"):
                invalid = create_app({**self.config, "MODEL_PATH": artifact}, self.banks)
            self.assertFalse(invalid.test_client().get("/api/health").json["diagnosis_available"])

    def test_category_shortage_is_not_silently_replaced(self):
        from backend.src.quiz import QuizBank
        small = {key: QuizBank(key[1], [i for i in bank.items if max(i.a,i.b)>=100][:20]) for key,bank in self.banks.items()}
        client=create_app(self.config,small).test_client()
        client.post("/api/auth/login",json={"email":self.email,"password":self.password})
        response=client.post("/api/sessions",json={"operation":"addition","number_category":"tens"})
        self.assertEqual(response.status_code,400)
        self.assertIn("15",response.json["message"])

    def test_all_categories_and_legacy_resume(self):
        from backend.src.quiz import CATEGORIES, number_category
        self.assertEqual(self.client.post("/api/sessions", json={"operation": "addition"}).status_code, 400)
        for op in ("addition", "subtraction"):
            for cat in CATEGORIES:
                session = self.client.post("/api/sessions", json={"operation": op, "number_category": cat}).json
                self.assertEqual(session["number_category"], cat)
                path = "/api" + urlsplit(session["join_url"]).path
                guests = [self.join(path, "Tes kategori") for _ in range(2)]
                cores=[]
                for guest in guests:
                    route=f'/api/attempts/{guest["attempt_id"]}'
                    headers=auth(guest["student_token"])
                    question=guest["question"]; ids=[]
                    for pos in range(1,16):
                        self.assertEqual(number_category(question["operand_1"],question["operand_2"]),cat)
                        ids.append(question["id"])
                        question=self.client.put(route+f"/responses/{pos}",headers=headers,json={"kind":"skipped"}).json["question"]
                    self.assertEqual(len(set(ids)),15)
                    cores.append(ids[:9])
                    self.client.post(route+"/finish",headers=headers)
                    detail=self.client.get(f'/api/sessions/{session["session_id"]}/results/{guest["attempt_id"]}').json
                    self.assertEqual(len(detail["evidence_timeline"]),15)
                    for pattern in detail["diagnosis"]["pattern_assessments"]:
                        self.assertEqual(detail["evidence_timeline"][-1]["matching_answers"][pattern["pattern"]],pattern["matching_answers"])
                    listed=self.client.get(f'/api/sessions/{session["session_id"]}/results').json
                    self.assertNotIn("evidence_timeline",listed["results"][0])
                    self.assertEqual(self.app.test_client().get(f'/api/sessions/{session["session_id"]}/results/{guest["attempt_id"]}',headers=headers).status_code,401)
                self.assertEqual(*cores)
        # Restore a session's legacy metadata/core before joining, then exercise its tail.
        session, path = self.create("addition")
        with Database(self.config["DATABASE"]).transaction(write=True) as store:
            store.execute("UPDATE sessions SET number_category=NULL,quiz_policy_version='adaptive-v1' WHERE id=%s",(session["session_id"],))
        guest=self.join(path,"Legacy")
        route=f'/api/attempts/{guest["attempt_id"]}'; headers=auth(guest["student_token"])
        for pos in range(1,16):
            self.assertEqual(self.client.put(route+f"/responses/{pos}",headers=headers,json={"kind":"skipped"}).status_code,200)
        self.assertEqual(self.client.post(route+"/finish",headers=headers).status_code,200)
        detail=self.client.get(f'/api/sessions/{session["session_id"]}/results/{guest["attempt_id"]}').json
        self.assertTrue(detail["diagnosis"]["diagnosis_policy_version"].startswith("legacy"))

    def test_url_change_and_https_cookie(self):
        session, _ = self.create("subtraction")
        secure = self.logged_in({**self.config, "FRONTEND_URL": "https://demo.example"})
        result = secure.get(f'/api/sessions/{session["session_id"]}').json
        self.assertEqual(result["code"], session["code"])
        self.assertEqual(urlsplit(result["join_url"]).path, urlsplit(session["join_url"]).path)
        self.assertEqual(urlsplit(result["join_url"]).netloc, "demo.example")
        cookie = secure.post("/api/auth/login", json={"email": self.email, "password": self.password}).headers["Set-Cookie"]
        self.assertIn("Secure", cookie)
        self.assertEqual(secure.post("/api/sessions", json={"operation": "addition", "number_category": "hundreds"}, headers={"Origin": "https://wrong.example"}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
