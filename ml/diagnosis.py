"""Multilabel diagnosis for completed multiple-choice quizzes."""

from importlib.metadata import version
from pathlib import Path
from tempfile import TemporaryDirectory

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from backend.src.quiz import CATALOG, QUIZ_SIZE

SCHEMA = "kirana-mcq-9plus6-v1"
METHODS = ("rules", "logistic")
PATTERN_NAMES = {
    "A1": "Mengabaikan simpanan", "A2": "Menulis seluruh hasil penjumlahan kolom",
    "A3": "Tidak mengatur ulang simpanan", "A4": "Menulis angka simpanan di kolom hasil",
    "S1": "Mengurangi digit kecil dari digit besar", "S2": "Lupa mengurangi angka pemberi pinjaman",
    "S3": "Menulis nol saat mengurangi dari nol", "S4": "Menyalin pengurang pada kolom nol",
    "S5": "Peminjaman melewati nol tidak diteruskan", "S6": "Terus meminjam setelah pinjaman pertama",
}


def runtime():
    return {name: version(name) for name in ("numpy", "scipy", "scikit-learn", "joblib")}


def evidence_columns(features, operation):
    if features.ndim != 2 or features.shape[1] != 4 + 4 * len(CATALOG[operation]):
        raise ValueError("Jumlah fitur tidak sesuai operasi.")
    return np.split(features[:, 4:], 4, axis=1)


def scores(features, operation, model, method):
    if method == "logistic":
        return model.predict_proba(features)
    _, answered, exact, unique = evidence_columns(features, operation)
    return np.divide(exact + unique, 2 * answered, out=np.zeros_like(exact, dtype=float), where=answered > 0)


def gate(features, operation):
    _, _, exact, unique = evidence_columns(features, operation)
    return (exact >= 2) & (unique >= 1)


def thresholds(scores, actual, eligible):
    candidates = np.r_[np.linspace(0, 1, 101), np.nextafter(1.0, np.inf)]
    choices = []
    for i in range(actual.shape[1]):
        selected = eligible[:, i, None] & (scores[:, i, None] >= candidates)
        tp = (selected & actual[:, i, None]).sum(axis=0)
        calls = selected.sum(axis=0)
        precision = np.divide(tp, calls, out=np.zeros_like(candidates), where=calls != 0)
        f05 = 1.25 * tp / (0.25 * actual[:, i].sum() + calls)
        choices.append(float(candidates[np.lexsort((candidates, precision, f05))[-1]]))
    return choices


def fit(operation, train, validation):
    model = make_pipeline(StandardScaler(), OneVsRestClassifier(LogisticRegression(max_iter=1000)))
    model.fit(*train)
    features, actual = validation
    eligible = gate(features, operation)
    return {
        "model": model,
        "labels": CATALOG[operation],
        "thresholds": {method: thresholds(scores(features, operation, model, method), actual, eligible)
                       for method in METHODS},
    }


def classify(operation, features, fitted, method):
    confidence = scores(features, operation, fitted["model"], method)
    return confidence, gate(features, operation) & (confidence >= fitted["thresholds"][method])


def export_model(path, fitted):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=path.parent) as temp:
        staged = Path(temp) / path.name
        joblib.dump({"schema": SCHEMA, "runtime": runtime(), "operations": fitted}, staged, compress=3)
        staged.replace(path)


def load_model(path):
    artifact = joblib.load(path)
    if artifact["schema"] != SCHEMA or artifact["runtime"] != runtime():
        raise ValueError("Skema atau versi model pilihan ganda tidak cocok.")
    operations = artifact["operations"]
    if set(operations) != set(CATALOG) or any(fitted["labels"] != CATALOG[op]
                                             for op, fitted in operations.items()):
        raise ValueError("Label model tidak cocok dengan katalog.")
    return operations


def diagnose(operation, evidence, history, model):
    if model is None:
        return {"status": "unavailable", "message": "Diagnosis belum tersedia.", "patterns": []}
    features = np.asarray([evidence.features()])
    if len(history) != QUIZ_SIZE:
        raise ValueError("Diagnosis memerlukan 15 respons.")
    confidence, accepted = classify(operation, features, model[operation], "logistic")
    findings = []
    for index, pattern in enumerate(CATALOG[operation]):
        if not accepted[0, index]:
            continue
        examples = [
            {"position": position, "operand_1": item.a, "operand_2": item.b,
             "selected_value": value, "correct_value": item.correct}
            for position, (item, kind, value) in enumerate(history, 1)
            if kind == "selected" and value != item.correct and item.predictions[pattern] == value
        ]
        findings.append({
            "pattern": pattern, "name": PATTERN_NAMES[pattern],
            "score": float(confidence[0, index]), "matching_answers": evidence.exact[pattern],
            "distinguishing_answers": evidence.unique[pattern],
            "shown_opportunities": evidence.shown[pattern],
            "answered_opportunities": evidence.answered[pattern], "examples": examples[:3],
            "follow_up": "Minta siswa menunjukkan langkah bersusun pada satu soal serupa.",
        })
    findings.sort(key=lambda item: (-item["distinguishing_answers"], -item["matching_answers"], -item["score"]))
    unresolved = [pattern for pattern in CATALOG[operation]
                  if evidence.answered[pattern] < 2 or
                  (evidence.exact[pattern] and pattern not in {item["pattern"] for item in findings})]
    return {
        "status": "supported" if findings else "insufficient_evidence" if unresolved else "no_pattern_detected",
        "message": "Bukti belum cukup." if unresolved else None,
        "unresolved_patterns": unresolved, "patterns": findings,
    }
