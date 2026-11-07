"""Run API tests on an isolated, temporary MySQL instance (never the application DB)."""
import argparse
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import secrets
import urllib.request
import pymysql


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mysql-bin", required=True, type=Path)
    parser.add_argument("--browser", action="store_true", help="Also start the three services and run Playwright (build frontend first).")
    args = parser.parse_args()
    backend = Path(__file__).resolve().parents[1]
    work = backend / ".local"
    work.mkdir(exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix="mysql-integration-", dir=work))
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    executable = str(args.mysql_bin / "mysqld.exe")
    hidden = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    subprocess.run([executable, "--no-defaults", "--initialize-insecure", f"--datadir={folder}"], check=True, creationflags=hidden)
    process = subprocess.Popen([executable, "--no-defaults", f"--datadir={folder}", f"--port={port}", "--bind-address=127.0.0.1", "--mysqlx=OFF"], creationflags=hidden)
    try:
        deadline = time.monotonic() + 90
        while True:
            try:
                connection = pymysql.connect(host="127.0.0.1", port=port, user="root", password="")
                break
            except pymysql.OperationalError:
                if process.poll() is not None or time.monotonic() > deadline:
                    raise
                time.sleep(.25)
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("CREATE DATABASE kirana_integration CHARACTER SET utf8mb4")
        env = {**os.environ, "KIRANA_DB_HOST": "127.0.0.1", "KIRANA_DB_PORT": str(port),
               "KIRANA_DB_USER": "root", "KIRANA_DB_PASSWORD": "", "KIRANA_DB_NAME": "unused_application_db",
               "KIRANA_TEST_DB_NAME": "kirana_integration"}
        result = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"], cwd=backend, env=env)
        if result.returncode or not args.browser:
            return result.returncode
        frontend = backend.parent / "frontend"
        password = secrets.token_urlsafe(24)
        def free_port():
            with socket.socket() as free:
                free.bind(("127.0.0.1",0))
                return free.getsockname()[1]
        frontend_port, gateway_port, flask_port = [free_port() for _ in range(3)]
        demo_url = f"http://localhost:{frontend_port}"
        demo_env = {**env, "KIRANA_DB_NAME": "kirana_integration", "KIRANA_FRONTEND_URL": demo_url,
                    "KIRANA_GATEWAY_PORT": str(gateway_port), "KIRANA_FLASK_PORT": str(flask_port), "KIRANA_FLASK_URL": f"http://127.0.0.1:{flask_port}",
                    "KIRANA_EXPRESS_URL": f"http://127.0.0.1:{gateway_port}", "KIRANA_TEST_BASE_URL": demo_url, "KIRANA_TEST_DIST": ".next-test",
                    "KIRANA_SEED_EMAIL": "e2e@kirana.local", "KIRANA_SEED_NAME": "Guru E2E", "KIRANA_SEED_PASSWORD": password,
                    "KIRANA_E2E_PASSWORD": password}
        subprocess.run([sys.executable, "seed.py"], cwd=backend, env=demo_env, check=True)
        children, logs = [], []
        try:
            for name, command, cwd in [
                ("flask", [sys.executable, "app.py"], backend),
                ("express", ["node", "server.mjs"], backend),
                ("next", ["node", "node_modules/next/dist/bin/next", "dev", "-p", str(frontend_port)], frontend),
            ]:
                log = (folder / (name + ".log")).open("w")
                logs.append(log)
                children.append(subprocess.Popen(command, cwd=cwd, env=demo_env, stdout=log, stderr=log, creationflags=hidden))
            deadline = time.monotonic() + 90
            while True:
                try:
                    with urllib.request.urlopen(demo_url + "/api/health", timeout=2) as response:
                        if response.status == 200:
                            break
                except (OSError, TimeoutError):
                    if time.monotonic() > deadline:
                        raise
                    time.sleep(.25)
            return subprocess.run(["node", "node_modules/@playwright/test/cli.js", "test"], cwd=frontend, env=demo_env).returncode
        finally:
            for child in reversed(children):
                if os.name == "nt":
                    subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"], capture_output=True, creationflags=hidden)
                else:
                    child.terminate()
                child.wait(timeout=15)
            for log in logs:
                log.close()
    finally:
        subprocess.run([str(args.mysql_bin / "mysqladmin.exe"), "--no-defaults", "-h127.0.0.1", f"-P{port}", "-uroot", "shutdown"], capture_output=True, creationflags=hidden)
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.terminate()
            process.wait(timeout=10)
        print("Data tes terisolasi disimpan di", folder)


if __name__ == "__main__":
    raise SystemExit(main())
