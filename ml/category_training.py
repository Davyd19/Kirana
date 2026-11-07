"""Category-aware experiments; no training runs on import."""
import argparse
from hashlib import file_digest
import json
from pathlib import Path
import random
import numpy as np
from backend.src.quiz import CATALOG, CATEGORIES, POLICY_VERSION, SPLITS, read_bank, category_banks, bank_coverage, seed_for
from .training import profiles, run_quiz, input_checksums
from .diagnosis import fit, scores, gate, thresholds, METHODS, export_category_model, load_category_model, runtime, CATEGORY_SCHEMA
from .paths import DATA_DIR, ML_DIR
from sklearn.metrics import precision_recall_fscore_support


def collect(data_dir=DATA_DIR, seed=42):
    original = read_bank(data_dir)
    banks = category_banks(original)
    coverage = bank_coverage(original)
    missing = [r for r in coverage if r["families"] < 15]
    if missing:
        raise ValueError(f"Kategori/split kekurangan soal: {missing}")
    samples = {(split, op, cat): ([], []) for split in SPLITS for op in CATALOG for cat in CATEGORIES}
    cores = {}
    for profile in profiles(data_dir):
        op, split, sid = (profile[k] for k in ("operation", "dataset_split", "student_id"))
        truth = [p in {profile["dominant_pattern"], profile["secondary_pattern"]} for p in CATALOG[op]]
        for cat in CATEGORIES:
            key = (split, op, cat, seed_for("cohort", sid) % 64)
            bank = banks[split, op, cat]
            if key not in cores:
                cores[key] = bank.core(random.Random(seed_for(seed, "core", key)))
            evidence = run_quiz(bank, cores[key], profile, seed, seed_for(seed, "tail", key), True)
            x, y = samples[split, op, cat]
            x.append(evidence.features()); y.append(truth)
    return {k: (np.asarray(x), np.asarray(y, dtype=bool)) for k, (x, y) in samples.items()}, coverage


def evaluate(op, fitted, data, category, measured, method):
    x, y = data
    conf = scores(x, op, fitted["model"], method)
    prediction = gate(x, op) & (conf >= fitted["category_thresholds"][category][method])
    mask = np.array([p in measured for p in CATALOG[op]])
    y, prediction = y[:, mask], prediction[:, mask]
    precision, recall, f1, support = precision_recall_fscore_support(y, prediction, zero_division=0)
    mixed = y.sum(axis=1) >= 2
    no_target = ~y.any(axis=1)
    _, _, exact, _ = np.split(x[:, 4:], 4, axis=1)
    preliminary = (exact[:, mask] >= 2) & ~prediction
    return {"sessions": len(x), "macro_f1": float(f1.mean()) if mask.any() else None,
            "false_pattern_calls": int((prediction & ~y).sum()),
            "true_patterns_found": int((prediction & y).sum()), "true_patterns": int(y.sum()),
            "mixed_sessions": int(mixed.sum()), "mixed_both_found": int(((prediction & y).sum(axis=1)[mixed] >= 2).sum()),
            "no_target_sessions": int(no_target.sum()), "no_target_with_calls": int(prediction[no_target].any(axis=1).sum()),
            "abstained": int((~prediction.any(axis=1)).sum()),
            "preliminary_false_calls": int((preliminary & ~y).sum()),
            "by_pattern": {p: {"precision": float(precision[i]), "recall": float(recall[i]), "f1": float(f1[i]), "support": int(support[i])}
                           for i, p in enumerate(p for p in CATALOG[op] if p in measured)},
            "not_measurable": [p for p in CATALOG[op] if p not in measured]}


def train_evaluate(samples, coverage):
    fitted, report = {}, {"schema": CATEGORY_SCHEMA, "quiz_policy_version": POLICY_VERSION, "versions": runtime(), "coverage": coverage, "results": {}}
    for op in CATALOG:
        train = tuple(np.concatenate([samples["train", op, cat][i] for cat in CATEGORIES]) for i in (0, 1))
        validation = tuple(np.concatenate([samples["validation", op, cat][i] for cat in CATEGORIES]) for i in (0, 1))
        if not np.all(train[1].any(axis=0) & (~train[1]).any(axis=0)):
            raise ValueError(f"Train {op} memerlukan kelas positif dan negatif setiap pola.")
        model = fit(op, train, validation)
        model["category_thresholds"] = {}
        for cat in CATEGORIES:
            x, y = samples["validation", op, cat]
            model["category_thresholds"][cat] = {m: thresholds(scores(x, op, model["model"], m), y, gate(x, op)) for m in METHODS}
        # Thresholds are now locked before inspecting test metrics.
        fitted[op] = model
        report["results"][op] = {}
        for cat in CATEGORIES:
            report["results"][op][cat] = {"thresholds": model["category_thresholds"][cat]}
            for split in ("validation", "test"):
                row = next(r for r in coverage if (r["split"],r["operation"],r["category"]) == (split,op,cat))
                measured = [p for p,n in row["shown_opportunities"].items() if n]
                report["results"][op][cat][split] = {m: evaluate(op,model,samples[split,op,cat],cat,measured,m) for m in METHODS}
    report["source_sha256"] = {}
    for source in (Path(__file__), Path(__file__).parents[1]/"backend/src/quiz.py", Path(__file__).with_name("diagnosis.py")):
        with source.open("rb") as file: report["source_sha256"][source.name] = file_digest(file,"sha256").hexdigest()
    return fitted, report


def export_verify(path, fitted, samples):
    export_category_model(path, fitted)
    loaded = load_category_model(path)
    for op in CATALOG:
        for cat in CATEGORIES:
            x = samples["validation",op,cat][0][:5]
            np.testing.assert_allclose(scores(x,op,fitted[op]["model"],"logistic"),scores(x,op,loaded[op]["model"],"logistic"))
            assert loaded[op]["category_thresholds"][cat] == fitted[op]["category_thresholds"][cat]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed",type=int,default=42)
    parser.add_argument("--export", action="store_true")
    args=parser.parse_args()
    samples, coverage=collect(seed=args.seed)
    fitted, report=train_evaluate(samples,coverage)
    report.update(seed=args.seed,input_sha256=input_checksums(DATA_DIR))
    path=ML_DIR / "reports/category_evaluation.json"
    path.write_text(json.dumps(report,indent=2),encoding="utf-8")
    if args.export: export_verify(ML_DIR / "artifacts/kirana_mcq_category_v2.joblib",fitted,samples)
    print("Evaluasi:",path, "Ekspor:",args.export)

if __name__ == "__main__": main()
