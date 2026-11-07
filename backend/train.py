"""Compatibility entry point for the former backend training command."""

from pathlib import Path
import sys

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from ml.training import main

    main()
