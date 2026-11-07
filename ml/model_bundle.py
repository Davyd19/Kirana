"""Single deployment artifact for legacy and category quiz policies."""

from pathlib import Path
from uuid import uuid4

import joblib

from backend.src.quiz import CATALOG, CATEGORIES, POLICY_VERSION
from .diagnosis import runtime

SCHEMA = "kirana-quiz-bundle-v1"
DEFAULT_PATH = Path(__file__).resolve().parent / "artifacts" / "kirana_model.joblib"


def _validate_operations(operations, category):
    if set(operations) != set(CATALOG):
        raise ValueError("Operasi model tidak lengkap.")
    for operation, labels in CATALOG.items():
        fitted = operations[operation]
        if fitted["labels"] != labels or not hasattr(fitted["model"], "predict_proba"):
            raise ValueError(f"Label atau estimator {operation} tidak cocok.")
        expected = {"category_thresholds": set(CATEGORIES)} if category else {"thresholds": {"rules", "logistic"}}
        for field, keys in expected.items():
            if set(fitted[field]) != keys:
                raise ValueError(f"Ambang {operation} tidak lengkap.")
        groups = fitted["category_thresholds"].values() if category else [fitted["thresholds"]]
        for group in groups:
            if set(group) != {"rules", "logistic"} or any(len(values) != len(labels) for values in group.values()):
                raise ValueError(f"Panjang ambang {operation} tidak cocok.")


def export_bundle(path, legacy, category, *, provenance):
    _validate_operations(legacy, False)
    _validate_operations(category, True)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"schema": SCHEMA, "runtime": runtime(), "category_policy_version": POLICY_VERSION,
               "categories": list(CATEGORIES), "legacy": legacy, "category": category,
               "provenance": provenance}
    staged = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        joblib.dump(payload, staged, compress=3)
        staged.replace(path)
    finally:
        staged.unlink(missing_ok=True)


def load_bundle(path):
    payload = joblib.load(path)
    if (payload.get("schema") != SCHEMA or payload.get("runtime") != runtime()
            or payload.get("category_policy_version") != POLICY_VERSION
            or set(payload.get("categories", [])) != set(CATEGORIES)):
        raise ValueError("Skema, kebijakan, atau versi dependensi model gabungan tidak cocok.")
    _validate_operations(payload["legacy"], False)
    _validate_operations(payload["category"], True)
    return payload
