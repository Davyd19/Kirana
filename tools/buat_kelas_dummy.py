"""Membuat satu sesi dummy (Pengurangan · Ratusan) berisi 15 siswa dengan jawaban bervariasi, lewat API asli.

MENULIS KE DATABASE: membuat sesi baru, 15 pengerjaan, lalu MENUTUP sesinya.
Jalankan dari root repositori saat Flask, Express, dan frontend menyala:
    .\backend\.venv\Scripts\python.exe tools\buat_kelas_dummy.py "<password guru>" kelas_dummy_log.json
"""
import http.cookiejar, json, random, sys, urllib.request
sys.path.insert(0, ".")
from ml.simulation import predict

BASE = "http://localhost:3000/api"
PW = sys.argv[1]
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with opener.open(req) as r:
        return json.loads(r.read() or b"{}")

# Persona: list (peluang, aksi). Aksi: "benar", "acak", "lewati", "luar", atau kode pola. Sisa peluang = jawaban benar.
PERSONA = [
    ("Andi",  "S2 konsisten",                      [(0.85, "S2")]),
    ("Budi",  "S2 konsisten",                      [(0.85, "S2")]),
    ("Citra", "S2 cukup konsisten",                [(0.70, "S2")]),
    ("Dewi",  "Campuran S2 + S5",                  [(0.50, "S2"), (0.35, "S5")]),
    ("Eko",   "Campuran S5 + S2",                  [(0.55, "S5"), (0.30, "S2")]),
    ("Fajar", "S3 tidak konsisten",                [(0.45, "S3")]),
    ("Gita",  "S3 konsisten",                      [(0.80, "S3")]),
    ("Hana",  "Menebak acak semua soal",           [(1.00, "acak")]),
    ("Indra", "Sering menebak",                    [(0.70, "acak")]),
    ("Joko",  "Paham, sesekali ceroboh",           [(0.15, "acak")]),
    ("Kiki",  "Paham sepenuhnya",                  []),
    ("Lina",  "Berganti-ganti pola tiap soal",     [(1.00, "rotasi")]),
    ("Maya",  "S1 konsisten",                      [(0.80, "S1")]),
    ("Nina",  "S2 tapi sering melewati",           [(0.40, "lewati"), (0.45, "S2")]),
    ("Oki",   "Salah hitung tidak berpola (luar opsi)", [(0.50, "luar")]),
]
ROTASI = ["S1", "S2", "S3", "S4", "S6"]

def choose(rng, rules, n):
    x = rng.random()
    for p, act in rules:
        if x < p:
            return ROTASI[n % len(ROTASI)] if act == "rotasi" else act
        x -= p
    return "benar"

def main():
    rng = random.Random(2026)
    call("POST", "/auth/login", {"email": "guru@kirana.local", "password": PW})
    s = call("POST", "/sessions", {"operation": "subtraction", "number_category": "hundreds"})
    token = s["join_url"].rstrip("/").split("/")[-1]
    log = {"session_id": s["session_id"], "code": s["code"], "students": []}
    for name, desc, rules in PERSONA:
        j = call("POST", f"/join/{token}", {"nickname": name})
        aid, st, q = j["attempt_id"], j["student_token"], j["question"]
        rec = {"nama": name, "persona": desc, "jawaban": []}
        for pos in range(1, 16):
            a, b = q["operand_1"], q["operand_2"]
            opts = {o["value"]: o["id"] for o in q["options"]}
            act = choose(rng, rules, pos)
            if act == "lewati":
                body, shown = {"kind": "skipped"}, "lewati"
            elif act == "luar":
                body, shown = {"kind": "outside_options"}, "luar opsi"
            elif act == "acak":
                v = rng.choice(list(opts)); body, shown = {"kind": "selected", "option_id": opts[v]}, f"{v} (tebak)"
            else:
                v = (a - b) if act == "benar" else predict(act, a, b)
                if v in opts:
                    body, shown = {"kind": "selected", "option_id": opts[v]}, f"{v} ({act})"
                else:
                    body, shown = {"kind": "outside_options"}, f"luar opsi ({act}→{v})"
            r = call("PUT", f"/attempts/{aid}/responses/{pos}", body, st)
            rec["jawaban"].append({"no": pos, "soal": f"{a}-{b}", "aksi": act, "dicatat": shown})
            q = r.get("question")
        call("POST", f"/attempts/{aid}/finish", None, st)
        log["students"].append(rec)
    call("POST", f"/sessions/{s['session_id']}/close")
    json.dump(log, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Sesi:", s["code"], s["session_id"])

main()
