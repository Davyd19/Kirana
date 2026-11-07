"""Paths for the bundled CSVs and model outputs."""

import os
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("KIRANA_DATA_DIR", ML_DIR)).resolve()
ARTIFACT = ML_DIR / "artifacts" / "kirana_mcq_v1.joblib"
EVALUATION_REPORT = ML_DIR / "reports" / "evaluation.json"
