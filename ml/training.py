"""Simulate matched quiz policies, evaluate on held-out splits, and export the adaptive model."""

import argparse
from collections import Counter
import csv
from hashlib import file_digest
import json
from pathlib import Path
import random

import numpy as np
from sklearn.metrics import f1_score, precision_recall_fscore_support

from backend.src.quiz import CATALOG, QUIZ_SIZE, SPLITS, Evidence, read_bank, seed_for

from . import simulation
from .diagnosis import METHODS, SCHEMA, classify, export_model, fit, load_model, runtime
from .paths import ARTIFACT, DATA_DIR, EVALUATION_REPORT


def profiles(data_dir):
    seen = set()
    with (data_dir / "dataset" / "synthetic_profiles.csv").open(encoding="utf-8-sig", newline="") as file:
        for profile in csv.DictReader(file):
            sid = profile["student_id"]
            if not sid or sid in seen or profile["dataset_split"] not in SPLITS:
                raise ValueError(f"ID siswa atau split tidak valid: {sid}")
            seen.add(sid)
            for key in ("pattern_consistency", "dominant_pattern_weight", "noise_rate", "slip_rate", "random_error_rate"):
                profile[key] = float(profile[key])
            if profile["profile_type"] == "SINGLE":
                profile["profile_type"] = profile["dominant_pattern"]
            yield profile


def simulate_answer(item, profile, seed):
    # Pair the same profile/question across both policies without sharing selector state.
    rng = random.Random(seed_for(seed, "answer", profile["random_seed"], profile["student_id"], item.id))
    q = {"operation": item.operation, "operand_1": item.a, "operand_2": item.b, "correct_answer": item.correct}
    answer, mechanism, _, _ = simulation.simulate_response(profile, q, rng)
    if mechanism == "random_error":
        return "selected", rng.choice(sorted(item.options))
    if answer == "":
        return "skipped", None
    if answer not in item.options:
        return "outside_options", None
    return "selected", answer


def run_quiz(bank, core, profile, seed, tail_seed, adaptive):
    evidence = Evidence(profile["operation"])
    offered = Evidence(profile["operation"])
    used = set()
    for position in range(QUIZ_SIZE):
        rng = random.Random(seed_for(tail_seed, position + 1))
        item = core[position] if position < len(core) else bank.next_item(used, evidence if adaptive else offered, rng)
        used.add(item.family)
        offered.add(item, "skipped")
        kind, value = simulate_answer(item, profile, seed)
        evidence.add(item, kind, value)
    return evidence


def collect(data_dir, seed):
    banks = read_bank(data_dir)
    samples = {(mode, split, op): ([], []) for mode in ("fixed", "adaptive") for split in SPLITS for op in CATALOG}
    totals = Counter()
    cores = {}
    for profile in profiles(data_dir):
        op, split, sid = (profile[key] for key in ("operation", "dataset_split", "student_id"))
        bank = banks[split, op]
        cohort = seed_for("cohort", sid) % 64
        key = (split, op, cohort)
        if key not in cores:
            cores[key] = bank.core(random.Random(seed_for(seed, "core", key)))
        labels = {profile["dominant_pattern"], profile["secondary_pattern"]}
        truth = [pattern in labels for pattern in CATALOG[op]]
        tail_seed = seed_for(seed, "tail", key)
        for mode in ("fixed", "adaptive"):
            evidence = run_quiz(bank, cores[key], profile, seed, tail_seed, mode == "adaptive")
            features, targets = samples[mode, split, op]
            features.append(evidence.features())
            targets.append(truth)
            totals.update({f"{mode}/{split}/{kind}": count for kind, count in evidence.counts.items()})
    return {key: (np.asarray(features), np.asarray(targets, dtype=bool))
            for key, (features, targets) in samples.items()}, dict(totals)


def metrics(op, fitted, data, method):
    features, actual = data
    _, predicted = classify(op, features, fitted, method)
    precision, recall, f1, support = precision_recall_fscore_support(actual, predicted, zero_division=0)
    mixed = actual.sum(axis=1) == 2
    none = ~actual.any(axis=1)
    mixed_hits = (actual & predicted).sum(axis=1)[mixed] == 2
    return {
        "sessions": len(actual), "macro_f1": float(f1_score(actual, predicted, average="macro", zero_division=0)),
        "true_patterns_found": int((actual & predicted).sum()), "true_patterns": int(actual.sum()),
        "false_pattern_calls": int((~actual & predicted).sum()),
        "mixed_both_found": int(mixed_hits.sum()), "mixed_sessions": int(mixed.sum()),
        "no_target_with_calls": int(predicted[none].any(axis=1).sum()), "no_target_sessions": int(none.sum()),
        "abstained": int((~predicted.any(axis=1)).sum()),
        "by_pattern": {p: {"precision": float(precision[i]), "recall": float(recall[i]),
                           "f1": float(f1[i]), "support": int(support[i])}
                       for i, p in enumerate(CATALOG[op])},
    }


def export_and_verify(path, adaptive_models, samples):
    export_model(path, adaptive_models)
    reloaded = load_model(path)
    for op in CATALOG:
        features = samples["adaptive", "validation", op][0][:3]
        for method in METHODS:
            np.testing.assert_array_equal(
                classify(op, features, adaptive_models[op], method)[1],
                classify(op, features, reloaded[op], method)[1],
            )


def input_checksums(data_dir):
    inputs = {name: data_dir / name for name in ("dataset/questions.csv", "dataset/synthetic_profiles.csv")}
    inputs["ml/simulation.py"] = Path(simulation.__file__)
    checksums = {}
    for name, path in inputs.items():
        with path.open("rb") as file:
            checksums[name] = file_digest(file, "sha256").hexdigest()
    return checksums


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--artifact", type=Path, default=ARTIFACT)
    parser.add_argument("--report", type=Path, default=EVALUATION_REPORT)
    args = parser.parse_args()
    samples, totals = collect(args.data_dir, args.seed)
    print("Simulasi fixed dan adaptive selesai.", flush=True)
    report = {"schema": SCHEMA, "seed": args.seed, "versions": runtime(), "outcomes": totals, "results": {}}
    report["input_sha256"] = input_checksums(args.data_dir)
    adaptive_models = {}
    for mode in ("fixed", "adaptive"):
        report["results"][mode] = {}
        for op in CATALOG:
            train, validation, test = (samples[mode, split, op] for split in SPLITS)
            if any(not np.all(y.any(axis=0) & (~y).any(axis=0)) for _, y in (train, validation, test)):
                raise ValueError(f"Tiap split {op} harus punya kedua kelas untuk setiap pola.")
            fitted = fit(op, train, validation)
            report["results"][mode][op] = {
                "thresholds": fitted["thresholds"],
                **{name: {method: metrics(op, fitted, data, method) for method in METHODS}
                   for name, data in (("validation", validation), ("test", test))},
            }
            if mode == "adaptive":
                adaptive_models[op] = fitted
    export_and_verify(args.artifact, adaptive_models, samples)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Artefak: {args.artifact}\nEvaluasi: {args.report}")


if __name__ == "__main__":
    main()
