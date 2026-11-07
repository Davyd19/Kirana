"""Simulasi read-only: rekap tingkat kelas setelah sesi ditutup.

Pertanyaan: jika setelah sesi ditutup sistem MENGAKUMULASI hasil semua siswa, seberapa akurat
dan actionable informasi yang bisa diberikan ke guru, dibanding membaca hasil per siswa?

Kelas sintetis 30 siswa dibentuk dari siswa simulasi bagian test (tidak dipakai melatih model):
  acak     : 30 siswa diambil acak dari populasi;
  satu_umum: 8 siswa punya pola X yang sama, 22 sisanya acak dari siswa tanpa pola X.

Tiga cara menghitung "berapa siswa di kelas yang punya pola X":
  didukung     : jumlah siswa berstatus "Pola didukung" untuk X;
  plus_waspada : didukung + siswa dengan >=2 jawaban cocok X yang belum lolos (peringatan dini);
  skor         : jumlah skor model X seluruh siswa (perkiraan jumlah yang diharapkan).

Jalankan dari root repositori:
    .\\backend\\.venv\\Scripts\\python.exe -m ml.simulasi_akumulasi_kelas
"""
import argparse
import json

import numpy as np

from backend.src.quiz import CATALOG, CATEGORIES
from . import category_training
from .diagnosis import gate, scores
from .model_bundle import DEFAULT_PATH, load_bundle
from .paths import DATA_DIR, ML_DIR

CLASS_SIZE, SHARED, CLASSES = 30, 8, 200
ALERT = 0.25  # "ajarkan ulang ke seluruh kelas" jika >= 25% siswa
METHODS = ("didukung", "plus_waspada", "skor")


def student_tiers(op, fitted, x, cat):
    p = len(CATALOG[op])
    s = scores(x, op, fitted["model"], "logistic")
    supported = gate(x, op) & (s >= np.asarray(fitted["category_thresholds"][cat]["logistic"]))
    exact = x[:, 4 + 2 * p:4 + 3 * p]
    warning = (exact >= 2) & ~supported
    return s, supported, warning


def estimate(method, s, supported, warning):
    if method == "didukung":
        return supported.sum(axis=0).astype(float)
    if method == "plus_waspada":
        return (supported | warning).sum(axis=0).astype(float)
    return s.sum(axis=0)


def make_classes(y, mask, kind, rng):
    n = len(y)
    if kind == "acak":
        return [(rng.choice(n, CLASS_SIZE, replace=False), None) for _ in range(CLASSES)]
    candidates = [j for j in np.where(mask)[0] if y[:, j].sum() >= SHARED and (~y[:, j]).sum() >= CLASS_SIZE - SHARED]
    classes = []
    for _ in range(CLASSES):
        j = rng.choice(candidates)
        with_x = rng.choice(np.where(y[:, j])[0], SHARED, replace=False)
        without = rng.choice(np.where(~y[:, j])[0], CLASS_SIZE - SHARED, replace=False)
        classes.append((np.concatenate([with_x, without]), j))
    return classes


def run(seed):
    bundle = load_bundle(DEFAULT_PATH)["category"]
    samples, coverage = category_training.collect(DATA_DIR, seed)
    rng = np.random.default_rng(seed)
    report = {"seed": seed, "class_size": CLASS_SIZE, "shared": SHARED, "classes_per_group": CLASSES, "alert": ALERT,
              "student_level": {}, "class_level": {}, "example": None}
    stud = {"supported": 0, "supported_ok": 0, "warning": 0, "warning_ok": 0, "true": 0, "true_supported": 0, "true_warned": 0}
    agg = {kind: {m: {"abs_err": 0.0, "cells": 0, "top_ok": 0, "classes": 0, "tp": 0, "fp": 0, "fn": 0, "tn": 0}
                  for m in METHODS} for kind in ("acak", "satu_umum")}
    for op in CATALOG:
        for cat in CATEGORIES:
            x, y = samples["test", op, cat]
            row = next(r for r in coverage if (r["split"], r["operation"], r["category"]) == ("test", op, cat))
            mask = np.array([row["shown_opportunities"][p] > 0 for p in CATALOG[op]])
            s, sup, warn = student_tiers(op, bundle[op], x, cat)
            sm, wm, ym = sup[:, mask], warn[:, mask], y[:, mask]
            stud["supported"] += int(sm.sum()); stud["supported_ok"] += int((sm & ym).sum())
            stud["warning"] += int(wm.sum()); stud["warning_ok"] += int((wm & ym).sum())
            stud["true"] += int(ym.sum()); stud["true_supported"] += int((sm & ym).sum()); stud["true_warned"] += int((wm & ym).sum())
            for kind in ("acak", "satu_umum"):
                for idx, shared in make_classes(y, mask, kind, rng):
                    truth = y[idx][:, mask].sum(axis=0)
                    for m in METHODS:
                        est = estimate(m, s[idx][:, mask], sup[idx][:, mask], warn[idx][:, mask])
                        a = agg[kind][m]
                        a["abs_err"] += float(np.abs(est - truth).sum()); a["cells"] += int(mask.sum()); a["classes"] += 1
                        a["top_ok"] += int(truth[np.argmax(est)] == truth.max())
                        t_alert, e_alert = truth >= ALERT * CLASS_SIZE, est >= ALERT * CLASS_SIZE
                        a["tp"] += int((t_alert & e_alert).sum()); a["fp"] += int((~t_alert & e_alert).sum())
                        a["fn"] += int((t_alert & ~e_alert).sum()); a["tn"] += int((~t_alert & ~e_alert).sum())
                    if report["example"] is None and kind == "satu_umum" and op == "subtraction" and cat == "hundreds":
                        names = [p for p, keep in zip(CATALOG[op], mask) if keep]
                        report["example"] = {"operation": op, "category": cat, "shared_pattern": CATALOG[op][shared],
                                             "rows": [{"pola": p, "sebenarnya": int(truth[i]),
                                                       "didukung": int(sup[idx][:, mask][:, i].sum()),
                                                       "waspada": int(warn[idx][:, mask][:, i].sum()),
                                                       "didukung_tepat": int((sup[idx][:, mask][:, i] & y[idx][:, mask][:, i]).sum()),
                                                       "waspada_tepat": int((warn[idx][:, mask][:, i] & y[idx][:, mask][:, i]).sum()),
                                                       "skor": round(float(s[idx][:, mask][:, i].sum()), 1)} for i, p in enumerate(names)],
                                             "students_without_any_supported": int((~sup[idx][:, mask].any(axis=1)).sum()),
                                             "students_without_any_signal": int((~(sup[idx][:, mask] | warn[idx][:, mask]).any(axis=1)).sum())}
    report["student_level"] = stud
    for kind, methods in agg.items():
        report["class_level"][kind] = {m: {"rata_rata_selisih_per_pola": a["abs_err"] / a["cells"],
                                           "pola_terbanyak_tepat": a["top_ok"] / a["classes"],
                                           "peringatan_kelas_presisi": a["tp"] / max(1, a["tp"] + a["fp"]),
                                           "peringatan_kelas_recall": a["tp"] / max(1, a["tp"] + a["fn"]),
                                           **{k: a[k] for k in ("tp", "fp", "fn", "tn", "classes")}} for m, a in methods.items()}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default=str(ML_DIR / "reports/simulasi_akumulasi_kelas.json"))
    args = parser.parse_args()
    report = run(args.seed)
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False)
    s = report["student_level"]
    print(f"Per siswa: didukung tepat {s['supported_ok']}/{s['supported']} ({s['supported_ok']/s['supported']:.1%}); "
          f"waspada tepat {s['warning_ok']}/{s['warning']} ({s['warning_ok']/s['warning']:.1%}); "
          f"pola benar tertangkap didukung {s['true_supported']/s['true']:.1%}, +waspada {(s['true_supported']+s['true_warned'])/s['true']:.1%}")
    for kind, methods in report["class_level"].items():
        print(f"--- Kelas {kind} ({methods['skor']['classes']} kelas) ---")
        for m, r in methods.items():
            print(f"  {m:13} selisih/pola={r['rata_rata_selisih_per_pola']:.2f} siswa  pola terbanyak tepat={r['pola_terbanyak_tepat']:.1%}  "
                  f"peringatan kelas presisi={r['peringatan_kelas_presisi']:.1%} recall={r['peringatan_kelas_recall']:.1%}")
    print("Contoh:", json.dumps(report["example"], ensure_ascii=False))
    print("Laporan:", args.output)


if __name__ == "__main__":
    main()
