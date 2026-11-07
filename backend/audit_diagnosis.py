"""Read-only audit of original responses. No student names or tokens in output."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import argparse
import json
import numpy as np
import pymysql
from backend.src.settings import database_settings
from backend.src.storage import answered_turns
from backend.src.quiz import gather_evidence, read_bank, bank_coverage
from ml.diagnosis import load_model, legacy_diagnose, classify
from ml.paths import ARTIFACT, ML_DIR


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit",type=int,default=20)
    args=parser.parse_args()
    if not 1 <= args.limit <= 1000: parser.error("limit harus 1–1000")
    model=load_model(ARTIFACT) if ARTIFACT.exists() else None
    result={"database_available":False,"attempts":[]}
    try:
        with pymysql.connect(**database_settings(),connect_timeout=5,cursorclass=pymysql.cursors.DictCursor) as db:
            with db.cursor() as cursor:
                cursor.execute("START TRANSACTION READ ONLY")
                cursor.execute("SELECT a.id,s.operation FROM attempts a JOIN sessions s ON s.id=a.session_id WHERE a.submitted=1 ORDER BY a.created_order DESC LIMIT %s",(args.limit,))
                attempts=cursor.fetchall()
                for index,row in enumerate(attempts,1):
                    cursor.execute("SELECT * FROM turns WHERE attempt_id=%s ORDER BY position",(row["id"],))
                    history=answered_turns(cursor.fetchall()); op=row["operation"]; ev=gather_evidence(op,history)
                    confidence=classify(op,np.asarray([ev.features()]),model[op],"logistic")[0][0] if model else None
                    result["attempts"].append({"audit_session":index,"operation":op,"counts":dict(ev.counts),
                        "status":legacy_diagnose(op,ev,history,model)["status"],
                        "patterns":[{"pattern":p,"exact":ev.exact[p],"unique":ev.unique[p],"shown":ev.shown[p],"answered":ev.answered[p],
                                     "score":float(confidence[i]) if confidence is not None else None,
                                     "threshold":model[op]["thresholds"]["logistic"][i] if model else None} for i,p in enumerate(ev.patterns)]})
                result["database_available"]=True
    except pymysql.MySQLError as error:
        result["error_code"]=error.args[0]
    output=ML_DIR/"reports/diagnosis_audit_latest.json"
    output.write_text(json.dumps(result,indent=2),encoding="utf-8")
    (ML_DIR/"reports/category_bank_audit.json").write_text(json.dumps(bank_coverage(read_bank()),indent=2),encoding="utf-8")
    print("Audit baseline model lama:", output, "Sesi:",len(result["attempts"]))

if __name__=="__main__": main()
