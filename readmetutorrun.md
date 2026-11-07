# Panduan Menjalankan Kirana di Komputer Windows Baru

Panduan ini menyiapkan **demo Kirana dengan database baru**. Tiga layanan yang dijalankan adalah Next.js, Express, dan Flask; MySQL harus menyala lebih dahulu.

## 1. Siapkan perangkat lunak

Instal Git, Python **3.13**, Node.js **22 atau lebih baru**, dan MySQL **8** (misalnya melalui Laragon). Pastikan perintah berikut bekerja di PowerShell:

```powershell
git --version
py -3.13 --version
node --version
npm --version
```

## 2. Ambil source code

Contoh lokasi pemasangan di komputer baru adalah `C:\Kirana`:

```powershell
git clone https://github.com/Davyd19/Kirana.git C:\Kirana
cd C:\Kirana
```

Jika repositori memerlukan akses GitHub, masuk menggunakan akun yang mempunyai izin. Empat CSV dataset sudah berada di `C:\Kirana\ml\dataset`.

## 3. Buat database MySQL

Nyalakan MySQL, masuk melalui MySQL Command Line atau Laragon, lalu jalankan SQL berikut. Ganti kedua contoh kata sandi dengan nilai pilihanmu.

```sql
CREATE DATABASE IF NOT EXISTS kirana CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'kirana'@'127.0.0.1'
IDENTIFIED BY 'kata_sandi_database_baru';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON kirana.* TO 'kirana'@'127.0.0.1';
```

## 4. Siapkan backend dan konfigurasi

Di PowerShell:

```powershell
cd C:\Kirana\backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm ci
Copy-Item .env.example .env
notepad .env
```

Isi sekurang-kurangnya nilai berikut di `.env`. Kata sandi database harus sama dengan yang dibuat pada langkah 3. Buat kata sandi guru yang berbeda.

```dotenv
KIRANA_DB_HOST=127.0.0.1
KIRANA_DB_PORT=3306
KIRANA_DB_NAME=kirana
KIRANA_DB_USER=kirana
KIRANA_DB_PASSWORD='kata_sandi_database_baru'

KIRANA_FRONTEND_URL=http://localhost:3000
KIRANA_GATEWAY_HOST=127.0.0.1
KIRANA_GATEWAY_PORT=3001
KIRANA_FLASK_URL=http://127.0.0.1:5000
KIRANA_FLASK_PORT=5000

KIRANA_SEED_EMAIL=guru@kirana.local
KIRANA_SEED_NAME=Guru Kirana
KIRANA_SEED_PASSWORD='kata_sandi_guru_baru'
```

Untuk penggunaan lokal, biarkan `KIRANA_FRONTEND_URL=http://localhost:3000`. File `.env` tidak ikut Git.

## 5. Siapkan frontend

```powershell
cd C:\Kirana\frontend
npm ci
Copy-Item .env.example .env.local
```

Isi `C:\Kirana\frontend\.env.local`:

```dotenv
KIRANA_EXPRESS_URL=http://127.0.0.1:3001
```

## 6. Sediakan model diagnosis

Berkas model **tidak ikut Git**. Di komputer lama saat ini terdapat `ml\artifacts\kirana_model.joblib`. Salin berkas itu melalui media yang kamu percaya ke:

```text
C:\Kirana\ml\artifacts\kirana_model.joblib
```

Jangan mengubah nama berkas. Backend sudah memakai lokasi tersebut secara bawaan. Gunakan artefak yang dihasilkan dari proyek dan lingkungan Python yang dipercaya.

Jika berkas model belum disalin, kuis dan skor masih dapat berjalan, tetapi diagnosis model kategori belum tersedia. Alternatifnya, jalankan `C:\Kirana\ml\notebooks\train_kirana.ipynb` di komputer baru, periksa evaluasinya, lalu aktifkan `EXPORT_MODEL = True` pada notebook. Proses training tidak perlu dijalankan setiap kali aplikasi dibuka.

## 7. Buat tabel dan akun guru

```powershell
cd C:\Kirana\backend
.\.venv\Scripts\python.exe migrate.py
.\.venv\Scripts\python.exe seed.py
```

Seeder dapat dijalankan ulang, tetapi **tidak mengganti kata sandi akun guru yang sudah ada**. Untuk database baru, gunakan email dan kata sandi guru yang diisi pada langkah 4.

## 8. Jalankan aplikasi

Buka **tiga terminal PowerShell** dan biarkan semuanya tetap berjalan.

**Terminal 1 — Flask**

```powershell
cd C:\Kirana\backend
.\.venv\Scripts\python.exe app.py
```

**Terminal 2 — Express**

```powershell
cd C:\Kirana\backend
npm start
```

**Terminal 3 — Next.js**

```powershell
cd C:\Kirana\frontend
npm run build
npm start
```

Untuk mengembangkan tampilan, `npm run dev` dapat menggantikan `npm run build` dan `npm start`. Jangan menjalankan `dev` dan `start` bersamaan pada port 3000.

## 9. Periksa aplikasi

Di terminal PowerShell lain:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

Buka `http://localhost:3000/login`, lalu masuk memakai akun guru dari `.env`. Setelah model gabungan disalin dan Flask dijalankan ulang, `diagnosis_available` serta `category_diagnosis_available` diharapkan bernilai `true`.

Guru dapat membuat sesi penjumlahan atau pengurangan dengan kategori Puluhan, Ratusan, atau Ribuan. Siswa masuk sebagai tamu melalui kode, QR, atau tautan.

## 10. Demo melalui VS Code Forward Ports

Forward **port 3000 saja**. Salin alamat HTTPS publik yang diberikan VS Code ke `KIRANA_FRONTEND_URL` di `C:\Kirana\backend\.env`, lalu restart Flask dan Express. Buka aplikasi guru dan siswa melalui alamat publik yang sama. QR serta tautan sesi akan memakai alamat tersebut.

Jika alamat Forward Ports berubah, perbarui `KIRANA_FRONTEND_URL` dan restart kedua layanan backend. Saat nilainya HTTPS, gunakan alamat HTTPS publik untuk login guru agar cookie sesi dapat dipakai.

## Jika ingin memindahkan sesi lama

Langkah di atas membuat **database kosong**. Sesi, peserta, dan jawaban dari komputer lama berada di MySQL, sehingga perlu backup dan restore database secara terpisah bila ingin dipertahankan. Menyalin source code dan model saja tidak memindahkan riwayat kuis.

## Jika halaman login menampilkan error Turbopack

Pada percakapan sebelumnya muncul error runtime tentang *module factory* `next/navigation.js`. Penyebab akhirnya belum dipastikan. Hentikan server frontend, buka ulang aplikasi dari alamat yang sama, lalu lakukan hard reload browser. Jika masih muncul, simpan log terminal Next.js dan pesan error browser untuk pemeriksaan lanjutan; jangan menganggap login atau model sebagai penyebab sebelum log tersebut diperiksa.