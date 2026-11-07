import unittest
import random
import tempfile
from unittest.mock import patch
from pathlib import Path
import numpy as np
from backend.src.quiz import read_bank, category_banks, gather_evidence, make_item, number_category, CATALOG, Evidence
from ml.diagnosis import diagnose, evidence_timeline, export_category_model, load_category_model, thresholds, METHODS
from ml.model_bundle import export_bundle, load_bundle

class ConstantModel:
    def __init__(self, n): self.n=n
    def predict_proba(self, x): return np.full((len(x), self.n),.95)

class DiagnosisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.banks=category_banks(read_bank())

    def report(self, history, op="subtraction", cat="tens", model=None):
        ev=gather_evidence(op,history)
        return diagnose(op,ev,history,None,category=cat,bank=self.banks["train",op,cat],category_model=model)

    def test_categories_and_all_correct(self):
        self.assertEqual(number_category(85,37),"tens")
        self.assertEqual(number_category(325,47),"hundreds")
        for op in CATALOG:
            bank=self.banks["train",op,"tens"]
            core=bank.core(random.Random(12)); used={i.family for i in core}; ev=Evidence(op)
            for item in core: ev.add(item,"selected",item.correct)
            items=list(core)
            while len(items)<15:
                item=bank.next_item(used,ev,random.Random(len(items)));items.append(item);used.add(item.family);ev.add(item,"selected",item.correct)
            report=self.report([(i,"selected",i.correct) for i in items],op)
            self.assertEqual(report["patterns"],[])
            self.assertEqual(report["status"],"no_pattern_detected")
            unmeasured={a["pattern"] for a in report["pattern_assessments"] if a["status"]=="not_measurable"}
            self.assertEqual(unmeasured,{"A3"} if op=="addition" else {"S5","S6"})

    def test_shared_answers_and_no_forced_diagnosis(self):
        item=make_item({"question_id":"test", "operation":"subtraction", "operand_1":52,"operand_2":27,"correct_answer":25})
        history=[(item,"selected",35)]*2+[(item,"skipped",None)]*13
        report=self.report(history)
        self.assertTrue(any(set(g["patterns"])=={"S1","S2"} for g in report["ambiguous_groups"]))
        self.assertEqual(report["status"],"ambiguous")
        for kind in ("skipped","outside_options"):
            result=self.report([(item,kind,None)]*15)
            self.assertEqual(result["patterns"],[])
            self.assertEqual(result["status"],"insufficient_evidence")
        once=self.report([(item,"selected",35)]+[(item,"selected",25)]*14)
        self.assertFalse(any(a["status"] in ("preliminary","supported","ambiguous") for a in once["pattern_assessments"]))
        timeline=evidence_timeline("subtraction",history)
        for assessment in report["pattern_assessments"]:
            self.assertEqual(timeline[-1]["matching_answers"][assessment["pattern"]],assessment["matching_answers"])

    def test_multiple_patterns_compatible_and_old_artifacts(self):
        bank=self.banks["train","addition","hundreds"]
        history=[]
        for pattern in ("A1","A2"):
            item=next(i for i in bank.items if pattern in i.exposed and sum(i.predictions[p]==i.predictions[pattern] for p in i.exposed)==1)
            history.extend([(item,"selected",item.predictions[pattern])]*2)
        history += [(bank.items[0],"skipped",None)]*11
        fitted={op:{"model":ConstantModel(len(labels)),"labels":labels,"category_thresholds":{cat:{m:[.5]*len(labels) for m in METHODS} for cat in ("tens","hundreds","thousands")}} for op,labels in CATALOG.items()}
        report=self.report(history,"addition","hundreds",fitted)
        self.assertEqual({p["pattern"] for p in report["patterns"]},{"A1","A2"})
        preliminary=self.report(history,"addition","hundreds")
        self.assertEqual(preliminary["status"],"preliminary")
        self.assertTrue(all(p["score"] is None for p in preliminary["pattern_assessments"]))
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path=Path(folder)/"model.joblib"
            export_category_model(path,fitted)
            restored=load_category_model(path)
            self.assertEqual(set(restored),set(CATALOG))
        from ml.paths import ARTIFACT
        if ARTIFACT.exists():
            with self.assertRaises(ValueError): load_category_model(ARTIFACT)

    def test_thresholds_only_choose_from_validation(self):
        x=np.array([[.9],[.2],[.6]]); y=np.array([[True],[False],[True]])
        result=thresholds(x,y,np.ones_like(y))
        self.assertGreater(result[0],.2)
        self.assertLessEqual(result[0],.6)

    def test_single_bundle_keeps_legacy_and_category_branches(self):
        from ml.unified_training import prepare_legacy
        legacy, provenance = prepare_legacy()
        category = {op: {"model": ConstantModel(len(labels)), "labels": labels,
                         "category_thresholds": {cat: {method: [.5] * len(labels) for method in METHODS}
                                                 for cat in ("tens", "hundreds", "thousands")}}
                    for op, labels in CATALOG.items()}
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
            path = Path(folder) / "kirana_model.joblib"
            export_bundle(path, legacy, category, provenance=provenance)
            restored = load_bundle(path)
            self.assertEqual(restored["provenance"], provenance)
            self.assertEqual(restored["legacy"]["addition"]["thresholds"], legacy["addition"]["thresholds"])
            self.assertEqual(restored["category"]["subtraction"]["category_thresholds"],
                             category["subtraction"]["category_thresholds"])
            from backend.src.api import create_app
            with patch("backend.src.api.Database"):
                app = create_app({"TESTING": True, "DATABASE": {}, "MODEL_PATH": None,
                                  "CATEGORY_MODEL_PATH": None, "MODEL_BUNDLE_PATH": path}, read_bank())
            health = app.test_client().get("/api/health").json
            self.assertTrue(health["diagnosis_available"])
            self.assertTrue(health["category_diagnosis_available"])
            from ml.paths import ARTIFACT
            if ARTIFACT.is_file():
                with patch("backend.src.api.Database"):
                    fallback = create_app({"TESTING": True, "DATABASE": {}, "MODEL_PATH": ARTIFACT,
                                           "CATEGORY_MODEL_PATH": None, "MODEL_BUNDLE_PATH": None}, read_bank())
                old_health = fallback.test_client().get("/api/health").json
                self.assertTrue(old_health["diagnosis_available"])
                self.assertFalse(old_health["category_diagnosis_available"])

    def test_simulator_uses_backend_category_selector_without_training(self):
        from ml.training import run_quiz
        from ml.category_training import profiles
        from ml.paths import DATA_DIR
        profile=next(profiles(DATA_DIR))
        bank=self.banks["train",profile["operation"],"tens"]
        core=bank.core(random.Random(42))
        evidence=run_quiz(bank,core,profile,42,123,True)
        self.assertEqual(sum(evidence.counts.values()),15)
