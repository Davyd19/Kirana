"""Audit read-only P0: apakah urutan pola didukung mencerminkan pola dominan siswa.

Skrip ini tidak dipakai aplikasi, tidak melatih ulang, dan tidak mengubah model.
Ia membangun ulang sesi simulasi yang sama dengan training kategori, memuat model
terpasang, lalu membandingkan beberapa cara mengurutkan pola:

- exact  : jumlah kecocokan, lalu jumlah pembeda (hitungan murni, tanpa ML)
- score  : skor logistik mentah (yang dipakai aplikasi sekarang)
- margin : skor - ambang kategori
- ratio  : skor / ambang kategori

Jalankan dari root repositori:
    .\\backend\\.venv\\Scripts\\python.exe -m ml.audit_dominant
"""

import argparse
import json

import numpy as np

from backend.src.quiz import CATALOG, CATEGORIES, SPLITS
from . import category_training
from .diagnosis import evidence_columns, gate
from .model_bundle import DEFAULT_PATH, load_bundle
from .paths import DATA_DIR, ML_DIR
from .training import profiles

RANKINGS = ("exact", "score", "margin", "ratio")
REPORT = ML_DIR / "reports" / "dominant_ranking_audit.json"
WEIGHT_BUCKETS = ((0.0, 0.6, "<0.60"), (0.6, 0.7, "0.60-0.69"), (0.7, 1.01, ">=0.70"))


def ranking_keys(method, exact, unique, score, threshold):
    """Kunci urut per pola (semakin besar semakin kuat). Bentuk: (n_pola, n_kunci)."""
    if method == "exact":
        return np.stack([exact, unique], axis=1).astype(float)
    if method == "score":
        return score[:, None]
    if method == "margin":
        return (score - threshold)[:, None]
    if method == "ratio":
        return np.divide(score, threshold, out=np.zeros_like(score), where=threshold > 0)[:, None]
    raise ValueError(method)


def top_choice(keys, candidates):
    """Indeks pola teratas di antara kandidat, dan apakah posisi teratas seri.

    Seri dipecah dengan urutan katalog (indeks terkecil) agar hasil deterministik,
    tetapi tetap dilaporkan sebagai seri.
    """
    if len(candidates) == 0:
        return None, False
    rows = [tuple(keys[i]) for i in candidates]
    best = max(rows)
    winners = [i for i, row in zip(candidates, rows) if row == best]
    return min(winners), len(winners) > 1


def labels_by_sample(data_dir=DATA_DIR):
    """Label dominan/sekunder dengan urutan baris yang sama seperti category_training.collect."""
    rows = {(split, op, cat): [] for split in SPLITS for op in CATALOG for cat in CATEGORIES}
    for profile in profiles(data_dir):
        op, split = profile["operation"], profile["dataset_split"]
        info = {"type": "MIXED" if profile["secondary_pattern"] else
                        "SINGLE" if profile["dominant_pattern"] else profile["profile_type"],
                "dominant": profile["dominant_pattern"] or None,
                "secondary": profile["secondary_pattern"] or None,
                "weight": float(profile["dominant_pattern_weight"])}
        for cat in CATEGORIES:
            rows[split, op, cat].append(info)
    return rows


def check_alignment(op, y, labels):
    """Pastikan label yang dibaca ulang cocok dengan target training (dominan ∪ sekunder)."""
    patterns = CATALOG[op]
    expected = np.array([[p in {lab["dominant"], lab["secondary"]} for p in patterns] for lab in labels], dtype=bool)
    if expected.shape != y.shape or not np.array_equal(expected, y):
        raise AssertionError(f"Label dominan tidak sejajar dengan sampel training untuk {op}.")


def new_counter():
    return {"n": 0, "hit": 0, "tied": 0, "chance": 0.0}


def add(counter, hit, tied, chance):
    counter["n"] += 1
    counter["hit"] += int(hit)
    counter["tied"] += int(tied)
    counter["chance"] += chance


def finish(counter):
    n = counter["n"]
    return {"sessions": n,
            "top1_is_dominant": counter["hit"],
            "accuracy": round(counter["hit"] / n, 4) if n else None,
            "top_tied": counter["tied"],
            "chance_accuracy": round(counter["chance"] / n, 4) if n else None}


def audit_group(op, x, y, labels, fitted, category):
    patterns = CATALOG[op]
    check_alignment(op, y, labels)
    score = fitted["model"].predict_proba(x)
    threshold = np.asarray(fitted["category_thresholds"][category]["logistic"], dtype=float)
    passed = gate(x, op)
    supported = passed & (score >= threshold)
    _, _, exact, unique = evidence_columns(x, op)

    populations = ("single_supported", "mixed_supported", "mixed_multi", "mixed_multi_exact_tied")
    result = {pool: {m: new_counter() for m in RANKINGS} for pool in populations}
    buckets = {name: {m: new_counter() for m in RANKINGS} for _, _, name in WEIGHT_BUCKETS}
    upper = {"mixed_multi": 0, "dominant_supported": 0}

    for i, lab in enumerate(labels):
        if lab["type"] not in ("SINGLE", "MIXED"):
            continue
        candidates = np.where(supported[i])[0]
        if len(candidates) == 0:
            continue
        dominant = patterns.index(lab["dominant"])
        chance = (1.0 / len(candidates)) if dominant in candidates else 0.0
        exact_top, exact_tied = top_choice(ranking_keys("exact", exact[i], unique[i], score[i], threshold), candidates)
        for method in RANKINGS:
            top, tied = top_choice(ranking_keys(method, exact[i], unique[i], score[i], threshold), candidates)
            hit = top == dominant
            if lab["type"] == "SINGLE":
                add(result["single_supported"][method], hit, tied, chance)
                continue
            add(result["mixed_supported"][method], hit, tied, chance)
            if len(candidates) >= 2:
                add(result["mixed_multi"][method], hit, tied, chance)
                if exact_tied:
                    add(result["mixed_multi_exact_tied"][method], hit, tied, chance)
                name = next(n for low, high, n in WEIGHT_BUCKETS if low <= lab["weight"] < high)
                add(buckets[name][method], hit, tied, chance)
        if lab["type"] == "MIXED" and len(candidates) >= 2:
            upper["mixed_multi"] += 1
            upper["dominant_supported"] += int(dominant in candidates)

    report = {pool: {m: finish(c) for m, c in counters.items()} for pool, counters in result.items()}
    report["mixed_multi_by_dominant_weight"] = {name: {m: finish(c) for m, c in counters.items()}
                                                for name, counters in buckets.items()}
    report["mixed_multi_dominant_in_supported"] = upper
    report["ml_filter"] = ml_filter(passed, supported, y)
    return report, result, buckets


def ml_filter(passed, supported, y):
    rejected = passed & ~supported
    return {"gate_passed": int(passed.sum()), "ml_rejected": int(rejected.sum()),
            "ml_rejected_correctly": int((rejected & ~y).sum()),
            "ml_rejected_true_pattern": int((rejected & y).sum()),
            "supported": int(supported.sum()), "supported_correct": int((supported & y).sum()),
            "gate_only_false_calls": int((passed & ~y).sum()),
            "gate_and_ml_false_calls": int((supported & ~y).sum())}


def merge(target, source):
    for key, value in source.items():
        if isinstance(value, dict):
            merge(target.setdefault(key, {}), value)
        else:
            target[key] = target.get(key, 0) + value


MIN_GAIN = 0.02


def accuracies(counters):
    return {m: c["hit"] / c["n"] if c["n"] else 0.0 for m, c in counters.items()}


def recommend(validation_mixed_multi, test_mixed_multi=None):
    """Pilih cara urut dari validation, lalu wajib terkonfirmasi di test.

    Sebuah cara berbasis ML hanya direkomendasikan jika unggul minimal MIN_GAIN atas
    hitungan murni (exact) di validation DAN tidak kalah dari exact di test.
    """
    val = accuracies(validation_mixed_multi)
    best = max(RANKINGS, key=lambda m: (round(val[m], 4), -RANKINGS.index(m)))
    result = {"validation_accuracy": {m: round(v, 4) for m, v in val.items()}, "best": best}
    test = accuracies(test_mixed_multi) if test_mixed_multi else None
    if test is not None:
        result["test_accuracy"] = {m: round(v, 4) for m, v in test.items()}
    if best == "exact" or val[best] - val["exact"] < MIN_GAIN:
        result["confirmed"] = False
        result["decision"] = ("Tidak ada cara berbasis ML yang jelas lebih baik dari hitungan di validation; "
                              "jangan klaim 'pola dominan', pertimbangkan P3.1.")
    elif test is not None and test[best] < test["exact"]:
        result["confirmed"] = False
        result["decision"] = (f"Urutan '{best}' unggul di validation tetapi kalah dari hitungan di test; "
                              "keunggulan tidak terkonfirmasi. Jangan klaim 'pola dominan', pertimbangkan P3.1.")
    else:
        result["confirmed"] = True
        result["decision"] = ("Skor mentah sudah terbaik dan terkonfirmasi; P1 cukup memberi label pada urutan yang ada."
                              if best == "score" else f"Gunakan urutan '{best}' untuk P1 (terkonfirmasi di test).")
    return result


def run(seed=42, model_path=DEFAULT_PATH):
    bundle = load_bundle(model_path)
    samples, _ = category_training.collect(DATA_DIR, seed)
    labels = labels_by_sample(DATA_DIR)
    report = {"seed": seed, "model_path": str(model_path), "rankings": list(RANKINGS),
              "provenance": bundle.get("provenance"), "splits": {}}
    totals = {}
    for split in ("validation", "test"):
        report["splits"][split] = {}
        totals[split] = {"result": {}, "buckets": {}, "ml_filter": {}}
        for op in CATALOG:
            report["splits"][split][op] = {}
            for cat in CATEGORIES:
                x, y = samples[split, op, cat]
                group, raw, buckets = audit_group(op, x, y, labels[split, op, cat], bundle["category"][op], cat)
                report["splits"][split][op][cat] = group
                merge(totals[split]["result"], raw)
                merge(totals[split]["buckets"], buckets)
                merge(totals[split]["ml_filter"], group["ml_filter"])
        report["splits"][split]["overall"] = {
            **{pool: {m: finish(c) for m, c in counters.items()} for pool, counters in totals[split]["result"].items()},
            "mixed_multi_by_dominant_weight": {n: {m: finish(c) for m, c in cs.items()}
                                               for n, cs in totals[split]["buckets"].items()},
            "ml_filter": totals[split]["ml_filter"],
        }
    report["recommendation"] = recommend(totals["validation"]["result"]["mixed_multi"],
                                         totals["test"]["result"]["mixed_multi"])
    return report


def print_summary(report):
    for split in ("validation", "test"):
        overall = report["splits"][split]["overall"]
        print(f"\n=== {split.upper()} (gabungan semua operasi & kategori) ===")
        for pool in ("single_supported", "mixed_supported", "mixed_multi", "mixed_multi_exact_tied"):
            row = overall[pool]
            n = row["exact"]["sessions"]
            cells = "  ".join(f"{m}={row[m]['accuracy']:.3f}" if row[m]["accuracy"] is not None else f"{m}=-"
                              for m in RANKINGS)
            chance = row["exact"]["chance_accuracy"]
            print(f"{pool:24s} n={n:5d}  {cells}  acak={chance if chance is not None else '-'}")
        f = overall["ml_filter"]
        print(f"ML filter: lolos gate={f['gate_passed']} ditolak ML={f['ml_rejected']} "
              f"(tepat={f['ml_rejected_correctly']}, pola benar ikut ditolak={f['ml_rejected_true_pattern']}); "
              f"dugaan keliru gate saja={f['gate_only_false_calls']} -> gate+ML={f['gate_and_ml_false_calls']}")
    rec = report["recommendation"]
    status = "TERKONFIRMASI" if rec["confirmed"] else "TIDAK TERKONFIRMASI"
    print(f"\nRekomendasi (dipilih dari validation, dicek di test): {rec['best']} [{status}]\n-> {rec['decision']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default=str(REPORT))
    args = parser.parse_args()
    report = run(args.seed)
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False)
        file.write("\n")
    print_summary(report)
    print(f"\nLaporan: {args.output}")


if __name__ == "__main__":
    main()
