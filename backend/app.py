"""Run the Flask API from the backend directory."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.src.api import create_app as create_app, main

if __name__ == "__main__":
    main()
