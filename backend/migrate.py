"""Apply additive MySQL schema migrations."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.settings import database_settings
from src.storage import Database

if __name__ == "__main__":
    Database(database_settings())
    print("Skema MySQL siap. Data lama dipertahankan.")
