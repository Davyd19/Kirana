"""Simulasi read-only: apa yang terjadi jika siswa TIDAK boleh melewati soal?

Dua keadaan siswa yang dipengaruhi aturan ini:
  - "kosong": siswa tidak punya jawaban (di simulasi asli sangat jarang, +-0,6% jawaban);
  - "ragu"  : uji sensitivitas, siswa ragu pada sebagian soal (10% / 20%) dan, jika boleh,
              akan menekan "Lewati". Jika tidak boleh, ia terpaksa menebak.
Siswa yang hasil hitungannya tidak ada di pilihan tetap memakai tombol "di luar opsi"
kecuali skenario juga menghapus tombol itu.

Model terpasang tidak diubah. Jalankan dari root repositori:
    .\\backend\\.venv\\Scripts\\python.exe -m ml.simulasi_tanpa_lewati
"""
import argparse
import json
import random

import numpy as np

from backend.src.quiz import CATALOG, QUIZ_SIZE, Evidence, read_bank, category_banks, seed_for
from . import category_training, simulation, training
from .diagnosis import diagnose
from .model_bundle import DEFAULT_PATH, load_bundle
from .paths import DATA_DIR, ML_DIR
from .simulasi_luar_opsi import evaluate

# (boleh_lewati, ada_tombol_luar_opsi, aksi_saat_ragu_tanpa_lewati)
SCENARIOS = {
    "A_sekarang": ("Sekarang: ada Lewati + ada tombol luar opsi", True, True, None),
    "B_tanpa_lewati_tebak": ("Tanpa Lewati, ragu -> menebak", False, True, "guess"),
    "C_tanpa_lewati_luar": ("Tanpa Lewati, ragu -> tekan 'di luar opsi'", False, True, "outside"),
    "D_tanpa_keduanya": ("Tanpa Lewati & tanpa tombol luar opsi", False, False, "guess"),
}
UNSURE_RATES = (0.0, 0.10, 0.20)


def respond(item, profile, seed, scenario, unsure):
    _, allow_skip, has_outside, forced = SCENARIOS[scenario]
    rng = random.Random(seed_for(seed, "answer", profile["random_seed"], profile["student_id"], item.id))
    q = {"operation": item.operation, "operand_1": item.a, "operand_2": item.b, "correct_answer": item.correct}
    answer, mechanism, _, _ = simulation.simulate_response(profile, q, rng)
    # Generator terpisah agar keputusan 'ragu' tidak menggeser jawaban simulasi asli.
    side = random.Random(seed_for(seed, "ragu", profile["student_id"], item.id))
    is_unsure = side.random() < unsure
    guess = sorted(item.options)[side.randrange(4)]

    if mechanism == "random_error":
        return "selected", rng.choice(sorted(item.options)), "acak"
    if answer == "" or is_unsure:
        if allow_skip:
            return "skipped", None, "ragu/kosong"
        if forced == "outside":
            return "outside_options", None, "ragu/kosong"
        return "selected", guess, "ragu/kosong"
    if answer not in item.options:
        if has_outside:
            return "outside_options", None, "luar opsi"
        return "selected", guess, "luar opsi"
    return "selected", answer, "normal"


def collect(scenario, unsure, seed):
    original = training.simulate_answer
    training.simulate_answer = lambda item, profile, s: respond(item, profile, s, scenario, unsure)[:2]
    try:
        return category_training.collect(DATA_DIR, seed)
    finally:
        training.simulate_answer = original


def example(bundle, seed, unsure=0.20, op="subtraction", cat="hundreds"):
    """Contoh ilustrasi: siswa test pertama yang hasilnya berubah dari A ke B pada tingkat ragu 20%."""
    bank = category_banks(read_bank(DATA_DIR))["test", op, cat]
    cores, changed, total, chosen = {}, 0, 0, None
    for profile in training.profiles(DATA_DIR):
        if profile["operation"] != op or profile["dataset_split"] != "test":
            continue
        key = ("test", op, cat, seed_for("cohort", profile["student_id"]) % 64)
        cores.setdefault(key, bank.core(random.Random(seed_for(seed, "core", key))))
        truth = {profile["dominant_pattern"], profile["secondary_pattern"]} - {""}
        runs = {}
        for scenario in ("A_sekarang", "B_tanpa_lewati_tebak"):
            ev, used, history, rows = Evidence(op), set(), [], []
            for position in range(QUIZ_SIZE):
                rng = random.Random(seed_for(seed_for(seed, "tail", key), position + 1))
                item = cores[key][position] if position < len(cores[key]) else bank.next_item(used, ev, rng)
                used.add(item.family)
                kind, value, why = respond(item, profile, seed, scenario, unsure)
                ev.add(item, kind, value)
                history.append((item, kind, value))
                rows.append({"no": position + 1, "soal": f"{item.a} - {item.b}", "benar": item.correct,
                             "opsi": sorted(item.options), "keadaan": why,
                             "dicatat": {"outside_options": "di luar opsi", "skipped": "dilewati"}.get(kind, value),
                             "cocok_pola": [p for p in item.exposed if kind == "selected" and value != item.correct and item.predictions[p] == value]})
            d = diagnose(op, ev, history, bundle["legacy"], category=cat, bank=bank, category_model=bundle["category"])
            runs[scenario] = {"supported": [a["pattern"] for a in d["pattern_assessments"] if a["status"] == "supported"],
                              "preliminary": [a["pattern"] for a in d["pattern_assessments"] if a["status"] == "preliminary"],
                              "scores": {a["pattern"]: a["score"] and round(a["score"], 3) for a in d["pattern_assessments"]},
                              "thresholds": {a["pattern"]: a["threshold"] and round(a["threshold"], 3) for a in d["pattern_assessments"]},
                              "counts": dict(ev.counts), "exact": dict(ev.exact), "unique": dict(ev.unique), "questions": rows}
        total += 1
        a, b = runs["A_sekarang"], runs["B_tanpa_lewati_tebak"]
        if a["supported"] != b["supported"]:
            changed += 1
            if chosen is None and a["supported"] and set(a["supported"]) <= truth and set(b["supported"]) - truth:
                chosen = {"student_id": profile["student_id"], "truth": sorted(truth), "runs": runs}
    return {"unsure_rate": unsure, "operation": op, "category": cat, "students": total,
            "supported_changed": changed, "example": chosen}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default=str(ML_DIR / "reports/simulasi_tanpa_lewati.json"))
    args = parser.parse_args()
    bundle = load_bundle(DEFAULT_PATH)

    reference, _ = category_training.collect(DATA_DIR, args.seed)
    report = {"seed": args.seed, "results": {}}
    for unsure in UNSURE_RATES:
        for scenario in SCENARIOS:
            samples, coverage = collect(scenario, unsure, args.seed)
            if unsure == 0 and scenario == "A_sekarang":
                for key in reference:  # pengaman: kondisi sekarang = pipeline training asli
                    assert np.array_equal(reference[key][0], samples[key][0]), key
            report["results"][f"{unsure:.2f}/{scenario}"] = evaluate(bundle["category"], samples, coverage)
            o = report["results"][f"{unsure:.2f}/{scenario}"]["overall"]
            print(f"ragu={unsure:4.0%}  {SCENARIOS[scenario][0]:46} F1={o['macro_f1']:.3f} presisi={o['precision']:.3f} "
                  f"recall={o['recall']:.3f} keliru={o['false_calls']:4d} d.awal_keliru={o['preliminary_false']:5d} "
                  f"dilewati={o['skipped']:6d} luar={o['outside']:6d} salah={o['wrong']:6d}", flush=True)
    report["example"] = example(bundle, args.seed)
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False, default=str)
    ex = report["example"]
    print(f"Contoh ragu 20% {ex['operation']}/{ex['category']}: 'didukung' berubah pada {ex['supported_changed']} dari {ex['students']} siswa")
    if ex["example"]:
        e = ex["example"]
        print("  ", e["student_id"], "benar:", e["truth"], "| A:", e["runs"]["A_sekarang"]["supported"], "| B:", e["runs"]["B_tanpa_lewati_tebak"]["supported"])
    print("Laporan:", args.output)


if __name__ == "__main__":
    main()
