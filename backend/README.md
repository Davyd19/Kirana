# Backend Kirana

Frontend memanggil Express. Express meneruskan permintaan API ke Flask. Flask mengelola kuis, skoring, dan diagnosis serta menyimpan sesi di MySQL.

## Struktur

| Lokasi | Tanggung jawab |
|---|---|
| `server.mjs` | Server Express yang menerima permintaan frontend. |
| `app.py` | Perintah untuk memulai Flask. |
| `src/api.py` dan `src/storage.py` | Rute dan otorisasi Flask, transaksi MySQL, serta penyimpanan sesi dan respons. |
| `src/quiz.py` | Bank soal, opsi, pemilihan adaptif, dan pencatatan bukti. |
| `src/settings.py` | Konfigurasi koneksi MySQL. |
| `tests/` | Pengujian Flask dan Express. |

Training, notebook, dan model ada di [folder ml](../ml/README.md). Flask memuat model tersebut saat mulai. Perintah lama `python train.py` di folder backend tetap mengarah ke training yang sama.

## Menjalankan di Windows

Buka PowerShell di `Source Code/Kirana/backend`. Gunakan Node.js 22, Python 3.13, dan MySQL 8.4.

```powershell
npm ci
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Backend membaca bank soal dari `../ml/dataset/questions.csv` dan membentuk opsi diagnostik dengan prosedur di `../ml/simulation.py`. Keduanya sudah ada di repositori. `KIRANA_DATA_DIR` dapat menunjuk ke folder lain yang berisi `dataset/questions.csv`.

### Siapkan MySQL

Nyalakan MySQL di Laragon. Masuk melalui klien MySQL dengan akun administrator, lalu jalankan sekali. Ganti kata sandi contoh dengan kata sandi yang kamu pilih.

```sql
CREATE DATABASE IF NOT EXISTS kirana CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'kirana'@'127.0.0.1' IDENTIFIED BY 'ganti_password_ini';
GRANT CREATE, SELECT, INSERT, UPDATE, REFERENCES ON kirana.* TO 'kirana'@'127.0.0.1';
```

Jika kamu sudah mempunyai database dan akun sendiri, gunakan nama serta kredensial akun itu. Flask membuat tabel `sessions`, `attempts`, dan `turns` saat mulai.

Salin [`.env.example`](.env.example) menjadi `.env` di folder backend, lalu isi kredensial MySQL milikmu. File `.env` diabaikan oleh Git.

```powershell
Copy-Item .env.example .env
```

Pakai port MySQL dari Laragon jika berbeda dari 3306. Tulis kata sandi yang mengandung spasi atau `#` dalam tanda kutip. Variabel lingkungan yang sudah diatur di terminal diutamakan jika namanya sama dengan pengaturan di `.env`.

### Mulai Flask dan Express

Jalankan Flask dan Express di terminal terpisah, dari folder backend.

```powershell
# Terminal 1
$env:KIRANA_FRONTEND_URL = 'http://localhost:5173'
.\.venv\Scripts\python.exe app.py
```

```powershell
# Terminal 2
$env:KIRANA_FRONTEND_URL = 'http://localhost:5173'
npm start
```

Express tersedia di `http://127.0.0.1:3000/api` dan Flask di `127.0.0.1:5000`. Periksa dengan `Invoke-RestMethod http://127.0.0.1:3000/api/health`. Alamat layanan dapat diatur lewat `KIRANA_FLASK_PORT`, `KIRANA_FLASK_URL`, dan `KIRANA_GATEWAY_PORT`.

### Mencoba QR dari ponsel

Jalankan frontend agar bisa dibuka melalui jaringan lokal dan sediakan rute `/join/:token`. Atur `KIRANA_FRONTEND_URL` di **kedua terminal** ke alamat frontend yang dapat dibuka dari ponsel, misalnya `http://192.168.1.10:5173` dengan IP komputer yang sebenarnya. Jika browser ponsel memanggil Express langsung, set `$env:KIRANA_GATEWAY_HOST = '0.0.0.0'` sebelum menjalankan Express dan arahkan frontend ke `http://192.168.1.10:3000/api`. Pastikan perangkat berada di jaringan yang sama dan port dapat diakses. Buat sesi baru setelah mengganti URL supaya QR membawa alamat baru. Konfigurasi ini ditujukan untuk pengujian lokal.

## Kontrak API

Semua rute di bawah relatif terhadap alamat Express. Kirim JSON dengan `Content-Type: application/json`. Gunakan `Authorization: Bearer <token>` untuk rute yang membutuhkan token guru atau siswa.

| Permintaan | Masukan dan keluaran |
|---|---|
| `GET /api/health` | Status layanan dan `diagnosis_available`. |
| `POST /api/sessions` | `{"operation":"subtraction"}` atau `addition`. Mengembalikan `session_id`, `operation`, `question_count`, `join_url`, `join_qr_svg`, dan `teacher_token`. Tampilkan SVG sebagai gambar dan `join_url` sebagai tautan yang bisa disalin. |
| `GET /api/join/:token` | Token dari segmen terakhir tautan. Mengembalikan operasi dan jumlah soal. |
| `POST /api/join/:token` | `{"nickname":"Ayu"}`. Mengembalikan `attempt_id`, `student_token`, operasi, jumlah soal, dan soal pertama. |
| `GET /api/attempts/:id/current` | Token siswa. Mengembalikan `question`, `ready_to_finish`, dan `submitted`. |
| `PUT /api/attempts/:id/responses/:position` | Token siswa. Kirim `{"kind":"selected","option_id":"0"}`, `{"kind":"outside_options"}`, atau `{"kind":"skipped"}`. Mengembalikan `accepted_position`, `question` berikutnya, dan `ready_to_finish`. |
| `POST /api/attempts/:id/finish` | Token siswa. Setelah 15 respons, mengembalikan `{"submitted":true}`. Aman dikirim ulang. |
| `GET /api/sessions/:id/results` | Token guru. Mengembalikan `results` untuk peserta yang sudah mengumpulkan. |

Soal berisi `id`, `position` (1–15), `operation`, `operand_1`, `operand_2`, dan empat `options` dengan pasangan `id` dan `value`. Kirim ID opsi sebagai string. Simpan token siswa dan ID percobaan di klien, lalu panggil `current` setelah memuat ulang. Jika pengiriman terganggu, ulangi payload yang sama. Payload berbeda untuk posisi yang sudah dijawab menghasilkan `409`. Setelah respons ke-15, `question` bernilai `null` dan `ready_to_finish` bernilai `true`.

Setiap hasil guru punya `summary` dengan `correct`, `wrong`, `outside_options`, dan `skipped`, serta `diagnosis` dengan status `supported`, `insufficient_evidence`, `no_pattern_detected`, atau `unavailable`. `patterns` memuat bukti dan contoh untuk setiap dugaan yang didukung. `unresolved_patterns` tersedia saat model aktif dan menunjukkan pola yang masih kurang bukti. Kunci jawaban muncul hanya pada contoh di laporan guru.

## Pengujian backend

Untuk tes API lengkap, siapkan database MySQL terpisah agar sesi uji terisolasi dari data aplikasi. Contoh SQL untuk akun lokal di atas:

```sql
CREATE DATABASE IF NOT EXISTS kirana_test CHARACTER SET utf8mb4;
GRANT CREATE, SELECT, INSERT, UPDATE, REFERENCES ON kirana_test.* TO 'kirana'@'127.0.0.1';
```

```powershell
$env:KIRANA_TEST_DB_NAME = 'kirana_test'
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
npm test
```

Tes integrasi dilewati jika `KIRANA_TEST_DB_NAME` belum diatur. Tes kebijakan kuis dan Express dapat dijalankan terpisah.
