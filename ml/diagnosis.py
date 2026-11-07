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

from backend.src.quiz import CATALOG, QUIZ_SIZE, CATEGORIES, POLICY_VERSION, Evidence

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


def legacy_diagnose(operation, evidence, history, model):
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


CATEGORY_SCHEMA = "kirana-mcq-category-v2"
DIAGNOSIS_VERSION = "evidence-status-v2"


def export_category_model(path, operations):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=path.parent) as temp:
        staged = Path(temp) / path.name
        joblib.dump({"schema": CATEGORY_SCHEMA, "runtime": runtime(), "quiz_policy_version": POLICY_VERSION,
                     "categories": list(CATEGORIES), "operations": operations}, staged, compress=3)
        staged.replace(path)


def load_category_model(path):
    artifact = joblib.load(path)
    if (artifact.get("schema") != CATEGORY_SCHEMA or artifact.get("runtime") != runtime()
            or artifact.get("quiz_policy_version") != POLICY_VERSION
            or set(artifact.get("categories", [])) != set(CATEGORIES)):
        raise ValueError("Artefak kategori tidak kompatibel.")
    for op in CATALOG:
        fitted = artifact["operations"][op]
        if fitted["labels"] != CATALOG[op] or set(fitted["category_thresholds"]) != set(CATEGORIES):
            raise ValueError("Label atau ambang kategori tidak lengkap.")
    return artifact["operations"]


def evidence_timeline(operation, history):
    evidence = Evidence(operation)
    points = []
    for position, (item, kind, value) in enumerate(history, 1):
        before = evidence.unique.copy()
        evidence.add(item, kind, value)
        points.append({"position": position, "operand_1": item.a, "operand_2": item.b,
                       "kind": kind, "selected_value": value, "correct_value": item.correct,
                       "matching_answers": {p: evidence.exact[p] for p in evidence.patterns},
                       "distinguishing_answers": {p: evidence.unique[p] for p in evidence.patterns},
                       "new_distinguishing": [p for p in evidence.patterns if evidence.unique[p] > before[p]]})
    return points


def diagnose(operation, evidence, history, model, *, category=None, bank=None, category_model=None):
    if len(history) != QUIZ_SIZE:
        raise ValueError("Diagnosis memerlukan 15 respons.")
    fitted = category_model.get(operation) if category and category_model else model.get(operation) if not category and model else None
    confidence, limits, accepted = None, None, None
    if fitted is not None:
        selected = {**fitted, "thresholds": fitted["category_thresholds"][category]} if category else fitted
        confidence, accepted = classify(operation, np.asarray([evidence.features()]), selected, "logistic")
        limits = selected["thresholds"]["logistic"]
    measurable = {p for p in CATALOG[operation] if bank is None or bank.by_pattern[p]}
    groups = [{"patterns": list(pair), "shared_answers": count,
               "reason": "Jawaban yang sama mendukung kedua kandidat; belum ada kecocokan pembeda."}
              for pair, count in sorted(evidence.shared.items())
              if count >= 2 and all(evidence.unique[p] == 0 and p in measurable for p in pair)]
    ambiguous = {p for group in groups for p in group["patterns"]}
    assessments = []
    for index, p in enumerate(CATALOG[operation]):
        reasons = []
        if p not in measurable:
            status = "not_measurable"
            reasons.append("Tidak terukur pada kategori ini: opsi bank soal tidak menyediakan kesempatan.")
        else:
            if fitted is None: reasons.append("Model kategori belum tersedia." if category else "Model belum tersedia.")
            if evidence.exact[p] < 2: reasons.append("Belum ada dua kecocokan jawaban.")
            if evidence.unique[p] < 1: reasons.append("Belum ada kecocokan yang membedakan pola ini.")
            if fitted is not None and confidence[0, index] < limits[index]: reasons.append("Skor model belum melewati ambang validasi.")
            if evidence.answered[p] < 2: reasons.append("Kesempatan yang dijawab pada sesi ini masih terbatas.")
            status = ("supported" if accepted is not None and accepted[0, index] else
                      "ambiguous" if p in ambiguous else "preliminary" if evidence.exact[p] >= 2 else
                      "insufficient_evidence" if evidence.exact[p] or evidence.answered[p] < 2 else "no_pattern_detected")
            if not reasons: reasons.append("Bukti dan skor memenuhi syarat pola didukung." if status == "supported" else "Tidak ada kecocokan pola pada sesi ini.")
        examples = [{"position": n, "operand_1": item.a, "operand_2": item.b,
                     "selected_value": value, "correct_value": item.correct}
                    for n, (item, kind, value) in enumerate(history, 1)
                    if kind == "selected" and value != item.correct and p in item.exposed and item.predictions[p] == value]
        assessments.append({"pattern": p, "name": PATTERN_NAMES[p], "status": status, "reasons": reasons,
                            "score": float(confidence[0, index]) if confidence is not None and p in measurable else None,
                            "threshold": float(limits[index]) if limits is not None and p in measurable else None,
                            "matching_answers": evidence.exact[p], "distinguishing_answers": evidence.unique[p],
                            "shown_opportunities": evidence.shown[p], "answered_opportunities": evidence.answered[p],
                            "examples": examples[:3], "follow_up": "Minta siswa menjelaskan langkah bersusun pada soal serupa."})
    findings = [a for a in assessments if a["status"] == "supported"]
    findings.sort(key=lambda a: -a["score"])
    states = {a["status"] for a in assessments if a["status"] != "not_measurable"}
    status = next((s for s in ("supported", "ambiguous", "preliminary", "insufficient_evidence") if s in states), "no_pattern_detected")
    # Legacy decisions remain intact, with explicitly versioned additional evidence views.
    legacy = legacy_diagnose(operation, evidence, history, model) if category is None else None
    return {"status": legacy["status"] if legacy else status,
            "patterns": legacy["patterns"] if legacy else findings,
            "message": ("Model kategori belum tersedia; bukti aturan bukan diagnosis model." if category else "Model belum tersedia.") if fitted is None else None,
            "pattern_assessments": assessments, "ambiguous_groups": groups,
            "model_compatibility": "compatible" if fitted is not None else "category_model_unavailable" if category else "unavailable",
            "diagnosis_policy_version": "legacy-v1+evidence-v2" if legacy else DIAGNOSIS_VERSION}
