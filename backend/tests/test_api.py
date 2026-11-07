from concurrent.futures import ThreadPoolExecutor
import os
import random
import unittest
from threading import Barrier
from urllib.parse import urlsplit

from app import create_app
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
                      "FRONTEND_URL": "http://192.168.1.10:5173", "MODEL_PATH": None}
        cls.banks = read_bank()

    def setUp(self):
        self.app = create_app(self.config, self.banks)
        self.client = self.app.test_client()

    def create(self, operation):
        response = self.client.post("/api/sessions", json={"operation": operation})
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
                teacher = auth(session["teacher_token"])
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
                reopened = create_app(self.config, self.banks).test_client()
                results = reopened.get(report_path, headers=teacher).json["results"]
                self.assertEqual([r["nickname"] for r in results], ["Ayu", "Bima"])
                for report in results:
                    self.assertEqual(report["summary"], {"correct": 1, "wrong": 1, "outside_options": 1, "skipped": 12})
                    self.assertEqual(report["diagnosis"]["status"], "unavailable")
                if ARTIFACT.is_file():
                    with_model = create_app({**self.config, "MODEL_PATH": ARTIFACT}, self.banks).test_client()
                    self.assertTrue(with_model.get("/api/health").json["diagnosis_available"])
                    diagnosed = with_model.get(report_path, headers=teacher).json["results"]
                    self.assertTrue(all(row["diagnosis"]["status"] == "insufficient_evidence" for row in diagnosed))


if __name__ == "__main__":
    unittest.main()
