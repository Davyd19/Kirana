"""Quiz policy shared by the Flask API and offline simulation."""

from collections import Counter
import csv
from dataclasses import dataclass
from hashlib import sha256
from itertools import combinations
import random

from ml.paths import DATA_DIR
from ml.simulation import CATALOG, predict

CORE_SIZE = 9
QUIZ_SIZE = 15
SPLITS = ("train", "validation", "test")
RESPONSE_KINDS = ("selected", "outside_options", "skipped")


def seed_for(*parts):
    return int.from_bytes(sha256(repr(parts).encode()).digest()[:8], "big")


@dataclass(frozen=True)
class Item:
    id: str
    operation: str
    a: int
    b: int
    correct: int
    predictions: dict
    options: tuple

    @property
    def family(self):
        if self.operation == "addition":
            return self.operation, min(self.a, self.b), max(self.a, self.b)
        return self.operation, self.a, self.b

    @property
    def exposed(self):
        return tuple(pattern for pattern, value in self.predictions.items()
                     if value != self.correct and value in self.options)

    def public(self, position):
        return {"id": self.id, "position": position, "operation": self.operation,
                "operand_1": self.a, "operand_2": self.b,
                "options": [{"id": str(index), "value": value} for index, value in enumerate(self.options)]}


def make_item(row):
    operation = row["operation"]
    a, b, correct = (int(row[key]) for key in ("operand_1", "operand_2", "correct_answer"))
    predictions = {pattern: predict(pattern, a, b) for pattern in CATALOG[operation]}
    wrong = list(dict.fromkeys(value for value in predictions.values() if value != correct))
    rng = random.Random(seed_for("options-v1", row["question_id"]))
    rng.shuffle(wrong)
    wrong.sort(key=lambda value: list(predictions.values()).count(value))
    options = [correct, *wrong[:3]]
    offset = 1
    while len(options) < 4:
        for candidate in (correct + offset, correct - offset):
            if candidate >= 0 and candidate not in options and candidate not in predictions.values():
                options.append(candidate)
                if len(options) == 4:
                    break
        offset += 1
    rng.shuffle(options)
    return Item(row["question_id"], operation, a, b, correct, predictions, tuple(options))


def read_bank(data_dir=DATA_DIR):
    groups = {(split, op): [] for split in SPLITS for op in CATALOG}
    families = {}
    ids = set()
    with (data_dir / "dataset" / "questions.csv").open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            item = make_item(row)
            split = row["dataset_split"]
            if item.id in ids or families.setdefault(item.family, split) != split:
                raise ValueError(f"Soal duplikat atau keluarga soal melintasi split: {item.id}")
            ids.add(item.id)
            groups[split, item.operation].append(item)
    return {key: QuizBank(key[1], items) for key, items in groups.items()}


class Evidence:
    def __init__(self, operation):
        self.patterns = CATALOG[operation]
        self.counts = Counter()
        self.shown = Counter()
        self.answered = Counter()
        self.exact = Counter()
        self.unique = Counter()
        self.shared = Counter()

    def add(self, item, kind, value=None):
        self.shown.update(item.exposed)
        if kind != "selected":
            self.counts[kind] += 1
            return
        self.answered.update(item.exposed)
        if value == item.correct:
            self.counts["correct"] += 1
            return
        self.counts["wrong"] += 1
        matches = [pattern for pattern in item.exposed if item.predictions[pattern] == value]
        self.exact.update(matches)
        if len(matches) == 1:
            self.unique.update(matches)
        self.shared.update(combinations(matches, 2))

    def features(self):
        totals = [self.counts[name] for name in ("correct", "wrong", "outside_options", "skipped")]
        return totals + [counter[pattern] for counter in (self.shown, self.answered, self.exact, self.unique)
                         for pattern in self.patterns]


def gather_evidence(operation, history):
    evidence = Evidence(operation)
    for item, kind, value in history:
        evidence.add(item, kind, value)
    return evidence


class QuizBank:
    def __init__(self, operation, items):
        self.patterns = CATALOG[operation]
        self.items = tuple(items)
        if len({item.family for item in self.items}) < QUIZ_SIZE:
            raise ValueError(f"Bank {operation} harus punya minimal 15 keluarga soal.")
        self.by_pattern = {p: tuple(item for item in self.items if p in item.exposed) for p in self.patterns}
        self.distinguishes = {
            (a, b): tuple(item for item in self.by_pattern[a]
                          if b in item.exposed and item.predictions[a] != item.predictions[b])
            for a, b in combinations(self.patterns, 2)
        }

    @staticmethod
    def pick(pool, used, rng):
        available = [item for item in pool if item.family not in used]
        return rng.choice(available) if available else None

    def core(self, rng):
        used = set()
        shown = Counter()
        items = []
        for _ in range(CORE_SIZE):
            for pattern in sorted(self.patterns, key=shown.__getitem__):
                item = self.pick(self.by_pattern[pattern], used, rng)
                if item is not None:
                    break
            else:
                item = self.pick(self.items, used, rng)
            items.append(item)
            used.add(item.family)
            shown.update(item.exposed)
        return items

    def next_item(self, used, evidence, rng):
        ambiguous = sorted((pair for pair in evidence.shared
                            if evidence.unique[pair[0]] == evidence.unique[pair[1]]),
                           key=lambda pair: (-evidence.shared[pair], pair))
        for pair in ambiguous:
            item = self.pick(self.distinguishes[pair], used, rng)
            if item is not None:
                return item
        for pattern in sorted(self.patterns, key=evidence.shown.__getitem__):
            item = self.pick(self.by_pattern[pattern], used, rng)
            if item is not None:
                return item
        return self.pick(self.items, used, rng)
