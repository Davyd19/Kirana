"""Simulasi read-only: seberapa berpengaruh tombol "Hasil saya tidak ada di pilihan"?

Membandingkan tiga perilaku siswa ketika hasil hitungannya TIDAK ada di 4 opsi:
  ada_tombol : siswa menekan "Hasil saya tidak ada di pilihan" (kondisi sekarang)
  menebak    : tombol dihapus, siswa memilih salah satu opsi secara acak
  melewati   : tombol dihapus, siswa menekan "Lewati"

Semua hal lain (profil siswa, bank soal, pemilih soal adaptif, model, ambang) sama persis
dengan pipeline training. Model terpasang TIDAK diubah; satu model tambahan dilatih ulang
di memori saja untuk skenario "menebak" sebagai pembanding kasus terbaik.

Jalankan dari root repositori:
    .\\backend\\.venv\\Scripts\\python.exe -m ml.simulasi_luar_opsi
"""
import argparse
import json
import random

import numpy as np

from backend.src.quiz import CATALOG, CATEGORIES, QUIZ_SIZE, Evidence, read_bank, category_banks, seed_for
from . import category_training, simulation, training
from .diagnosis import diagnose
from .model_bundle import DEFAULT_PATH, load_bundle
from .paths import DATA_DIR, ML_DIR

MODES = ("ada_tombol", "menebak", "melewati")
NAMES = {"ada_tombol": "Ada tombol (sekarang)", "menebak": "Tanpa tombol, siswa menebak",
         "melewati": "Tanpa tombol, siswa melewati"}


def respond(item, profile, seed, mode):
    """Salinan training.simulate_answer; hanya cabang 'di luar opsi' yang bergantung pada mode."""
    rng = random.Random(seed_for(seed, "answer", profile["random_seed"], profile["student_id"], item.id))
    q = {"operation": item.operation, "operand_1": item.a, "operand_2": item.b, "correct_answer": item.correct}
    answer, mechanism, _, _ = simulation.simulate_response(profile, q, rng)
    if mechanism == "random_error":
        return "selected", rng.choice(sorted(item.options)), answer, True
    if answer == "":
        return "skipped", None, answer, False
    if answer not in item.options:
        if mode == "ada_tombol":
            return "outside_options", None, answer, True
        if mode == "menebak":
            return "selected", rng.choice(sorted(item.options)), answer, True
        return "skipped", None, answer, True
    return "selected", answer, answer, False


def collect(mode, seed):
    original = training.simulate_answer
    training.simulate_answer = lambda item, profile, s: respond(item, profile, s, mode)[:2]
    try:
        return category_training.collect(DATA_DIR, seed)
    finally:
        training.simulate_answer = original


def summarize(op, fitted, data, cat, measured):
    x, y = data
    result = category_training.evaluate(op, fitted, data, cat, measured, "logistic")
    exact = x[:, 4 + 2 * len(CATALOG[op]):4 + 3 * len(CATALOG[op])]
    mask = np.array([p in measured for p in CATALOG[op]])
    fake = np.where(y[:, mask], 0, exact[:, mask])
    return {"sessions": result["sessions"], "macro_f1": result["macro_f1"] or 0.0,
            "true_patterns": result["true_patterns"], "true_found": result["true_patterns_found"],
            "false_calls": result["false_pattern_calls"], "preliminary_false": result["preliminary_false_calls"],
            "outside": int(x[:, 2].sum()), "skipped": int(x[:, 3].sum()), "wrong": int(x[:, 1].sum()),
            "fake_matches": int(fake.sum()), "fake_sessions": int((fake >= 2).any(axis=1).sum())}


def evaluate(models, samples, coverage):
    rows = {}
    for op in CATALOG:
        for cat in CATEGORIES:
            row = next(r for r in coverage if (r["split"], r["operation"], r["category"]) == ("test", op, cat))
            measured = [p for p, n in row["shown_opportunities"].items() if n]
            rows[f"{op}/{cat}"] = summarize(op, models[op], samples["test", op, cat], cat, measured)
    keys = next(iter(rows.values())).keys()
    total = {k: sum(r[k] for r in rows.values()) for k in keys if k != "macro_f1"}
    total["macro_f1"] = sum(r["macro_f1"] for r in rows.values()) / len(rows)
    total["precision"] = total["true_found"] / max(1, total["true_found"] + total["false_calls"])
    total["recall"] = total["true_found"] / max(1, total["true_patterns"])
    return {"overall": total, "per_group": rows}


def quiz_with_history(bank, core, profile, seed, tail_seed, mode):
    evidence, used, history, shown = Evidence(profile["operation"]), set(), [], []
    for position in range(QUIZ_SIZE):
        rng = random.Random(seed_for(tail_seed, position + 1))
        item = core[position] if position < len(core) else bank.next_item(used, evidence, rng)
        used.add(item.family)
        kind, value, computed, outside = respond(item, profile, seed, mode)
        evidence.add(item, kind, value)
        history.append((item, kind, value))
        shown.append({"no": position + 1, "soal": f"{item.a} - {item.b}" if item.operation == "subtraction" else f"{item.a} + {item.b}",
                      "benar": item.correct, "opsi": sorted(item.options), "dihitung_siswa": computed,
                      "di_luar_opsi": computed != "" and computed not in item.options,
                      "dicatat": "di luar opsi" if kind == "outside_options" else "dilewati" if kind == "skipped" else value,
                      "cocok_pola": [p for p in item.exposed if kind == "selected" and value != item.correct and item.predictions[p] == value]})
    return evidence, history, shown


def examples(bundle, seed, op="subtraction", cat="hundreds", limit=1):
    """Cari siswa test pertama yang diagnosisnya berubah jika tombol dihapus (contoh ilustrasi)."""
    banks = category_banks(read_bank(DATA_DIR))
    bank, cores, found = banks["test", op, cat], {}, []
    changed = total = 0
    for profile in training.profiles(DATA_DIR):
        if profile["operation"] != op or profile["dataset_split"] != "test":
            continue
        key = ("test", op, cat, seed_for("cohort", profile["student_id"]) % 64)
        cores.setdefault(key, bank.core(random.Random(seed_for(seed, "core", key))))
        truth = {profile["dominant_pattern"], profile["secondary_pattern"]} - {"", "NONE", None}
        runs = {}
        for mode in ("ada_tombol", "menebak"):
            ev, hist, shown = quiz_with_history(bank, cores[key], profile, seed, seed_for(seed, "tail", key), mode)
            d = diagnose(op, ev, hist, bundle["legacy"], category=cat, bank=bank, category_model=bundle["category"])
            runs[mode] = {"status": d["status"], "supported": [a["pattern"] for a in d["pattern_assessments"] if a["status"] == "supported"],
                          "preliminary": [a["pattern"] for a in d["pattern_assessments"] if a["status"] == "preliminary"],
                          "scores": {a["pattern"]: (None if a["score"] is None else round(a["score"], 3)) for a in d["pattern_assessments"]},
                          "thresholds": {a["pattern"]: (None if a["threshold"] is None else round(a["threshold"], 3)) for a in d["pattern_assessments"]},
                          "counts": dict(ev.counts), "exact": dict(ev.exact), "unique": dict(ev.unique), "questions": shown}
        total += 1
        a, b = runs["ada_tombol"], runs["menebak"]
        if a["supported"] != b["supported"]:
            changed += 1
            good_a = set(a["supported"]) <= truth and a["supported"]
            bad_b = set(b["supported"]) - truth
            if good_a and bad_b and len(found) < limit and a["counts"].get("outside_options", 0) >= 2:
                found.append({"student_id": profile["student_id"], "truth": sorted(truth),
                              "profile": {k: profile[k] for k in ("profile_type", "dominant_pattern", "secondary_pattern", "pattern_consistency")},
                              "runs": runs})
    return {"operation": op, "category": cat, "students": total, "supported_changed": changed, "examples": found}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default=str(ML_DIR / "reports/simulasi_luar_opsi.json"))
    args = parser.parse_args()
    bundle = load_bundle(DEFAULT_PATH)
    deployed = bundle["category"]

    samples, coverage = {}, None
    for mode in MODES:
        samples[mode], coverage = collect(mode, args.seed)
    # Pengaman: mode 'ada_tombol' harus identik dengan pipeline training asli.
    reference, _ = category_training.collect(DATA_DIR, args.seed)
    for key in reference:
        assert np.array_equal(reference[key][0], samples["ada_tombol"][key][0]), f"Simulasi tidak identik: {key}"

    report = {"seed": args.seed, "scenarios": {}}
    for mode in MODES:
        report["scenarios"][mode] = evaluate(deployed, samples[mode], coverage)
    retrained, _ = category_training.train_evaluate(samples["menebak"], coverage)
    report["scenarios"]["menebak_latih_ulang"] = evaluate(retrained, samples["menebak"], coverage)
    report["example"] = examples(bundle, args.seed)

    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False, default=str)

    print("=== Data TEST, semua operasi & kategori ===")
    head = f"{'Skenario':38} {'macroF1':>7} {'presisi':>7} {'recall':>7} {'keliru':>6} {'d.awal keliru':>13} {'cocok palsu':>11}"
    print(head)
    for mode in (*MODES, "menebak_latih_ulang"):
        o = report["scenarios"][mode]["overall"]
        label = NAMES.get(mode, "Tanpa tombol, menebak + model dilatih ulang")
        print(f"{label:38} {o['macro_f1']:7.3f} {o['precision']:7.3f} {o['recall']:7.3f} {o['false_calls']:6d} {o['preliminary_false']:13d} {o['fake_matches']:11d}")
    o = report["scenarios"]["ada_tombol"]["overall"]
    print(f"Sesi test: {o['sessions']}; respons 'di luar opsi' pada kondisi sekarang: {o['outside']} dari {o['sessions'] * QUIZ_SIZE} "
          f"({100 * o['outside'] / (o['sessions'] * QUIZ_SIZE):.1f}%)")
    ex = report["example"]
    print(f"Contoh {ex['operation']}/{ex['category']}: status 'didukung' berubah pada {ex['supported_changed']} dari {ex['students']} siswa test")
    for e in ex["examples"]:
        print("  ", e["student_id"], "benar:", e["truth"], "| ada tombol:", e["runs"]["ada_tombol"]["supported"],
              "| menebak:", e["runs"]["menebak"]["supported"])
    print("Laporan:", args.output)


if __name__ == "__main__":
    main()
