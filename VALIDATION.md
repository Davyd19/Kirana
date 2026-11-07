# Validasi integrasi — 7 November 2026

## Hasil otomatis

| Pemeriksaan | Hasil |
|---|---|
| TypeScript frontend | Lulus |
| ESLint frontend | Lulus |
| Build produksi Next.js | Lulus |
| Tes proxy Express | 1 lulus; method/body/query/status, Authorization, Cookie, Set-Cookie, dan origin |
| Tes Flask + MySQL 8.4.3 terisolasi | 5 lulus |
| Tes browser Edge dengan tiga layanan nyata | 1 skenario lulus mencakup kedua operasi |
| Artefak ML lokal | Berhasil dimuat untuk addition dan subtraction; tidak dilatih ulang |

Tes API mencakup login/sandi salah, seeder berulang, kepemilikan antarguru, kode/tautan/QR konsisten, cookie HTTPS, URL berubah tanpa mengganti token, dua peserta dengan inti bersama, 15 soal unik, tiga jenis respons, pengiriman ulang dan dua permintaan bersamaan, pengumpulan ulang, sesi ditutup, progres setelah refresh, laporan sesuai hitungan, model tersedia/tidak tersedia/rusak, dan data lama tanpa pemilik tetap tidak diklaim.

Tes pemilih soal mempertahankan kasus 52−27=35 dan soal pembeda 71−38 yang menampilkan 43 serta 47.

Tes browser memakai guru dan siswa di konteks browser terpisah. Layar siswa berukuran 390×844. Guru membuat sesi, siswa masuk melalui kode untuk penjumlahan dan URL untuk pengurangan, menyelesaikan 15 soal, lalu guru membuka rincian 15 jawaban. Tes sengaja memutus respons HTTP setelah server menerima jawaban; retry tidak melompati soal. Refresh mempertahankan urutan opsi/progres. Penutupan sesi menolak peserta baru tetapi peserta aktif tetap selesai. Tidak ada error JavaScript halaman selama skenario.

Screenshot hasil tes tersedia lokal di `frontend/test-results` (diabaikan Git). Database sementara dan log ada di `backend/.local/mysql-integration-*`. Runner menghentikan layanan tes setelah selesai. Database aplikasi pengguna tidak dipakai, dan akun seeder aplikasi belum dimasukkan ke database pengguna.

## Reproduksi

Ikuti langkah dependensi pada README backend dan frontend, lalu build frontend. Jalankan dari backend:

```powershell
npm test
.\.venv\Scripts\python.exe tests\run_mysql_tests.py --mysql-bin C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin --browser
```

Tutup layanan pada 3000, 3001, 5000 sebelum menjalankan runner browser. Runner menggunakan akun dan database khusus tes.

## Pemeriksaan manual sebelum presentasi

Belum diuji pada ponsel fisik atau tunnel VS Code milik pengguna. Lakukan:

1. Aktifkan MySQL aplikasi, jalankan migrasi/seeder, lalu ketiga layanan.
2. Forward port 3000; atur akses publik untuk peserta. Isi URL HTTPS pada konfigurasi backend dan restart Flask/Express.
3. Buka URL publik dari laptop dan ponsel. Login guru dengan akun seeder.
4. Buat sesi; pindai QR dari ponsel. Pastikan halaman nama panggilan menuju sesi yang sama dengan kode manual.
5. Jawab, refresh, lanjutkan sampai mengumpulkan. Periksa hasil muncul di laptop maksimal setelah interval polling.
6. Tutup sesi saat siswa masih mengerjakan; siswa itu tetap dapat menyelesaikan dan peserta baru ditolak.
7. Jika domain tunnel berubah, ubah konfigurasi, restart backend, buka ulang detail sesi, dan bagikan ulang QR.

## Batas hasil

Pengujian ini memvalidasi integrasi aplikasi, bukan akurasi diagnosis pada siswa nyata. Model tetap artefak yang dilatih pada data sintetis. Tidak ada training ulang atau perubahan dataset/algoritma. Layanan Flask yang dipakai ditujukan untuk demo lokal, bukan konfigurasi deployment produksi.
