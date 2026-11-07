"""Create the initial teacher without overwriting existing credentials."""
import secrets
from werkzeug.security import generate_password_hash
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.settings import database_settings, environment
from src.storage import Database


def seed_teacher(database, email, name, password):
    email = email.strip().lower()
    if "@" not in email or not name.strip() or not password:
        raise ValueError("Isi email, nama, dan kata sandi guru pada .env.")
    with database.transaction(write=True) as store:
        if store.fetch_one("SELECT id FROM teachers WHERE email=%s", (email,)):
            return False
        store.execute("INSERT INTO teachers (id,email,name,password_hash) VALUES (%s,%s,%s,%s)",
                      (secrets.token_urlsafe(24), email, name.strip(), generate_password_hash(password)))
    return True


if __name__ == "__main__":
    env = environment()
    created = seed_teacher(Database(database_settings()), env.get("KIRANA_SEED_EMAIL", ""),
                           env.get("KIRANA_SEED_NAME", ""), env.get("KIRANA_SEED_PASSWORD", ""))
    print("Akun guru dibuat." if created else "Akun sudah ada; kata sandi tidak diubah.")
