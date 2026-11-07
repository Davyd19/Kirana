# Backend Kirana

## Persiapan Windows

Gunakan Python 3.13, Node.js 22.9 atau lebih baru, dan MySQL 8 (misalnya Laragon). Aktifkan MySQL terlebih dahulu. Tidak perlu menjalankan Apache.

Buka PowerShell:

```powershell
cd 'C:\Davyd\Kirana\Source Code\Kirana\backend'
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm ci
```

Jika `.venv` sudah tersedia, lewati pembuatan venv. Perintah memakai Python venv secara langsung sehingga tidak memerlukan Activate.ps1.

Buat database dan pengguna menggunakan akun pengelola MySQL, jika belum ada:

```sql
CREATE DATABASE IF NOT EXISTS kirana CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'kirana'@'127.0.0.1' IDENTIFIED BY 'ganti_password_database';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON kirana.* TO 'kirana'@'127.0.0.1';
```

Samakan password database dengan `KIRANA_DB_PASSWORD` pada `.env`. Jika memakai akun MySQL yang sudah ada, isi konfigurasi akun tersebut; jangan jalankan contoh SQL dengan password placeholder.

File `.env` lokal sudah dipertahankan dan dilengkapi konfigurasi yang belum ada. Pada checkout baru, salin `.env.example` menjadi `.env`. File ini tidak masuk Git.

```dotenv
KIRANA_DB_HOST=127.0.0.1
KIRANA_DB_PORT=3306
KIRANA_DB_NAME=kirana
KIRANA_DB_USER=kirana
KIRANA_DB_PASSWORD='password_database'
KIRANA_FRONTEND_URL=http://localhost:3000
KIRANA_GATEWAY_HOST=127.0.0.1
KIRANA_GATEWAY_PORT=3001
KIRANA_FLASK_URL=http://127.0.0.1:5000
KIRANA_FLASK_PORT=5000
KIRANA_SEED_EMAIL=guru@kirana.local
KIRANA_SEED_NAME=Guru Kirana
KIRANA_SEED_PASSWORD='password_login_guru'
```

Password database dan password guru berbeda fungsi. Pada workspace ini password awal guru telah dibuat acak dalam `.env`; lihat atau ganti nilainya sebelum pertama menjalankan seeder. Tidak ada password yang ditampilkan di log.

Jalankan migrasi dan seeder:

```powershell
.\.venv\Scripts\python.exe migrate.py
.\.venv\Scripts\python.exe seed.py
```

Migrasi hanya menambah tabel/kolom; tidak menghapus data lama. Sesi lama tanpa pemilik tidak otomatis diberikan kepada akun seeder. Seeder berulang tidak menggandakan akun atau mengganti sandi akun yang sudah ada. Mengubah `.env` setelah akun dibuat tidak mengubah sandi database guru.

## Menjalankan

Terminal pertama di folder backend:

```powershell
.\.venv\Scripts\python.exe app.py
```

Terminal kedua di folder backend:

```powershell
npm start
```

Jalankan frontend mengikuti panduannya. Lihat kesehatan melalui **alamat frontend**:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

`diagnosis_available` dan `category_diagnosis_available` menunjukkan dua cabang model yang berhasil dimuat. Flask mengutamakan satu berkas `ml/artifacts/kirana_model.joblib`, yang dapat diarahkan melalui `KIRANA_MODEL_BUNDLE_PATH`. Sebelum berkas itu ada, Flask masih membaca artefak v1 dan kategori lama jika tersedia. Versi dependensi dan skema wajib cocok. Artefak joblib hanya boleh berasal dari training yang dipercaya. Jika model belum tersedia, kuis dan skor tetap berjalan. Restart Flask setelah mengganti artefak; tidak ada training ulang otomatis.

Semua variabel backend dibaca dari `.env`; variabel terminal mengunggulinya. Restart Express dan Flask setelah konfigurasi diubah.

## Demo VS Code Forward Ports

1. Jalankan ketiga layanan, buka tab **Ports** VS Code, lalu forward port **3000** saja.
2. Atur visibilitas port agar peserta demo dapat membuka alamatnya tanpa akun VS Code pemilik. Jangan membagikan password guru kepada siswa.
3. Salin alamat HTTPS publik tersebut ke `KIRANA_FRONTEND_URL` dalam `.env` (tanpa `/join`, query, atau slash akhir).
4. Restart Express dan Flask. Akses guru dan siswa melalui alamat publik yang sama; setelah mengganti alamat, login guru kembali.
5. Buat atau buka ulang detail sesi. URL dan QR mengikuti alamat terbaru; kode/token sesi tetap sama. Bagikan ulang QR jika domain tunnel berubah.
6. MySQL, port 3001, dan port 5000 tidak perlu diteruskan.

Gunakan frontend hasil `npm run build` dan `npm start` saat demo agar tidak tergantung server pengembangan. Domain tunnel lama tidak dapat dialihkan oleh aplikasi jika sudah tidak aktif.

## Pengujian

```powershell
npm test
.\.venv\Scripts\python.exe tests\run_mysql_tests.py --mysql-bin C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin
```

Runner membuat instance MySQL terisolasi pada port kosong, menjalankan tes, lalu menghentikannya. Data tes berada di `.local/mysql-integration-*`; database aplikasi tidak digunakan.

Untuk pengujian browser end-to-end, jalankan `npm ci` dan `npm run build` di frontend terlebih dahulu, lalu:

```powershell
.\.venv\Scripts\python.exe tests\run_mysql_tests.py --mysql-bin C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin --browser
```

Runner memilih port kosong dan direktori .next-test terpisah, menjalankan ketiga layanan dan akun guru khusus tes, menguji melalui Microsoft Edge headless, kemudian menghentikan layanan. Gunakan `KIRANA_BROWSER_CHANNEL=chrome` jika ingin Chrome terpasang. Laporan gagal berada di `frontend/test-results`. Pemeriksaan ini tidak melakukan training.


## Menjalankan revisi kategori

1. Jalankan `migrate.py` memakai Python venv, lalu restart Flask dan Express. Migrasi menambah kategori dan versi kebijakan tanpa mengubah soal/respons lama.
2. Build ulang frontend (`npm run build`) lalu jalankan frontend. Pembuatan sesi wajib memilih operasi dan kategori.
3. Sesi lama bertanda Campuran—sesi lama tetap bisa diselesaikan. Laporan menyertakan versi penilaian dan fingerprint artefak.
4. Untuk sesi kategori baru, artefak v1 tidak digunakan untuk skor. Sampai model kategori selesai dilatih, laporan memakai bukti aturan dengan status dugaan awal, ambigu, belum cukup, atau tidak terukur.
5. Ikuti notebook `ml/notebooks/train_kirana.ipynb` untuk training sendiri. Ekspor menghasilkan `ml/artifacts/kirana_model.joblib` berisi model sesi lama dan kategori. Restart Flask setelah ekspor; periksa kedua indikator pada `/api/health`. `KIRANA_MODEL_PATH` dan `KIRANA_CATEGORY_MODEL_PATH` hanya dipakai sebagai jalur transisi sebelum model gabungan tersedia.

Audit ulang respons asli secara read-only:

```powershell
.\.venv\Scripts\python.exe audit_diagnosis.py --limit 20
```

Audit menghasilkan diagnosis_audit_latest.json tanpa nama atau token dan membandingkan respons dengan baseline model lama; tidak menimpa audit tiga percobaan awal. Tidak ada respons siswa yang diubah.
