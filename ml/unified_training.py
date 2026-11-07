"""One experiment workflow and one export for both quiz policies."""

import argparse
from hashlib import file_digest
import json

import numpy as np

from backend.src.quiz import CATALOG
from . import category_training, training
from .diagnosis import fit, load_model, scores
from .model_bundle import DEFAULT_PATH, export_bundle, load_bundle
from .paths import ARTIFACT, DATA_DIR, ML_DIR


def prepare_legacy(seed=42):
    """Preserve the deployed legacy estimator when available; otherwise fit it on old policy data."""
    if ARTIFACT.is_file():
        with ARTIFACT.open("rb") as source:
            digest = file_digest(source, "sha256").hexdigest()
        return load_model(ARTIFACT), {"source": "existing_legacy_artifact", "sha256": digest}
    samples, _ = training.collect(DATA_DIR, seed)
    fitted = {op: fit(op, samples["adaptive", "train", op], samples["adaptive", "validation", op])
              for op in CATALOG}
    return fitted, {"source": "refit_legacy_policy", "seed": seed,
                    "test": {op: training.metrics(op, fitted[op], samples["adaptive", "test", op], "logistic")
                             for op in CATALOG}}


def train_categories(seed=42):
    samples, coverage = category_training.collect(DATA_DIR, seed)
    fitted, report = category_training.train_evaluate(samples, coverage)
    report.update(seed=seed, input_sha256=training.input_checksums(DATA_DIR))
    return fitted, report, samples


def export_and_verify(legacy, category, samples, provenance, path=DEFAULT_PATH):
    export_bundle(path, legacy, category, provenance=provenance)
    loaded = load_bundle(path)
    for operation in CATALOG:
        x = samples["validation", operation, "tens"][0][:5]
        np.testing.assert_allclose(scores(x, operation, category[operation]["model"], "logistic"),
                                   scores(x, operation, loaded["category"][operation]["model"], "logistic"))
        assert loaded["legacy"][operation]["thresholds"] == legacy[operation]["thresholds"]
        assert loaded["category"][operation]["category_thresholds"] == category[operation]["category_thresholds"]
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--export", action="store_true", help="Simpan satu model gabungan setelah meninjau evaluasi")
    args = parser.parse_args()
    legacy, legacy_info = prepare_legacy(args.seed)
    category, report, samples = train_categories(args.seed)
    report["legacy"] = legacy_info
    path = ML_DIR / "reports" / "category_evaluation.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Evaluasi: {path}")
    if args.export:
        print(f"Model: {export_and_verify(legacy, category, samples, legacy_info)}")


if __name__ == "__main__":
    main()
