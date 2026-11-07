"""Test logika audit P0 (ml/audit_dominant.py) tanpa menjalankan simulasi penuh."""
import unittest

import numpy as np

from backend.src.quiz import CATALOG
from ml.audit_dominant import RANKINGS, check_alignment, ml_filter, ranking_keys, recommend, top_choice


class RankingTests(unittest.TestCase):
    def setUp(self):
        # Tiga pola: kecocokan seri antara pola 0 dan 1; pola 1 punya skor mentah tertinggi,
        # tetapi pola 0 paling jauh melewati ambangnya.
        self.exact = np.array([3, 3, 2])
        self.unique = np.array([1, 1, 1])
        self.score = np.array([0.70, 0.80, 0.90])
        self.threshold = np.array([0.40, 0.75, 0.95])

    def top(self, method, candidates=(0, 1, 2)):
        keys = ranking_keys(method, self.exact, self.unique, self.score, self.threshold)
        return top_choice(keys, list(candidates))

    def test_exact_tie_is_reported_and_broken_by_catalog_order(self):
        self.assertEqual(self.top("exact"), (0, True))

    def test_raw_score_picks_highest_probability(self):
        self.assertEqual(self.top("score"), (2, False))

    def test_margin_and_ratio_respect_per_pattern_threshold(self):
        self.assertEqual(self.top("margin"), (0, False))   # 0.30 > 0.05 > -0.05
        self.assertEqual(self.top("ratio"), (0, False))    # 1.75 > 1.07 > 0.95

    def test_only_candidates_are_ranked(self):
        self.assertEqual(self.top("score", candidates=(0, 1)), (1, False))
        self.assertEqual(top_choice(ranking_keys("score", self.exact, self.unique, self.score, self.threshold), []),
                         (None, False))

    def test_unknown_ranking_rejected(self):
        with self.assertRaises(ValueError):
            ranking_keys("unknown", self.exact, self.unique, self.score, self.threshold)


class AlignmentAndFilterTests(unittest.TestCase):
    def test_alignment_accepts_matching_and_rejects_shifted_labels(self):
        patterns = CATALOG["addition"]
        labels = [{"dominant": "A1", "secondary": "A4"}, {"dominant": None, "secondary": None}]
        y = np.array([[p in {"A1", "A4"} for p in patterns], [False] * len(patterns)])
        check_alignment("addition", y, labels)
        with self.assertRaises(AssertionError):
            check_alignment("addition", y[::-1], labels)

    def test_ml_filter_counts(self):
        passed = np.array([[True, True], [True, False]])
        supported = np.array([[True, False], [False, False]])
        truth = np.array([[True, False], [True, False]])
        self.assertEqual(ml_filter(passed, supported, truth), {
            "gate_passed": 3, "ml_rejected": 2, "ml_rejected_correctly": 1, "ml_rejected_true_pattern": 1,
            "supported": 1, "supported_correct": 1, "gate_only_false_calls": 1, "gate_and_ml_false_calls": 0})

    def test_recommendation_prefers_counting_when_ml_gain_is_small(self):
        counters = {m: {"n": 100, "hit": 60} for m in RANKINGS}
        counters["margin"]["hit"] = 61
        self.assertIn("P3.1", recommend(counters)["decision"])
        counters["margin"]["hit"] = 70
        result = recommend(counters)
        self.assertEqual(result["best"], "margin")
        self.assertTrue(result["confirmed"])
        self.assertIn("margin", result["decision"])

    def test_recommendation_requires_test_confirmation(self):
        validation = {m: {"n": 100, "hit": 60} for m in RANKINGS}
        validation["score"]["hit"] = 66
        test_worse = {m: {"n": 100, "hit": 66} for m in RANKINGS}
        test_worse["score"]["hit"] = 64
        result = recommend(validation, test_worse)
        self.assertEqual(result["best"], "score")
        self.assertFalse(result["confirmed"])
        self.assertIn("tidak terkonfirmasi", result["decision"])
        test_ok = {m: {"n": 100, "hit": 60} for m in RANKINGS}
        test_ok["score"]["hit"] = 65
        self.assertTrue(recommend(validation, test_ok)["confirmed"])


if __name__ == "__main__":
    unittest.main()
