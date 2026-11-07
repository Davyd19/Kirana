# Revisi kategori, diagnosis, dan tampilan — 7 November 2026

## Audit tiga percobaan asli

Database aplikasi dibaca melalui transaksi read-only; tidak ada respons atau profil yang diubah. Hasil audit tersimpan di `ml/reports/revision_original_audit.json`, tanpa nama, ID asli, atau token.

| Percobaan (terbaru dahulu) | Respons | Temuan baseline lama |
|---|---|---|
| 1, penjumlahan | 13 benar, 2 salah | A2 dan A3 masing-masing hanya 1 kecocokan/pembeda. Belum memenuhi minimal dua kecocokan. |
| 2, pengurangan | 3 benar, 12 salah | S1 memiliki 5 kecocokan dan 4 pembeda, skor 0,899829 di bawah ambang 0,92. S2 dan S3 masing-masing 3 kecocokan, tetapi skor juga di bawah ambang. |
| 3, pengurangan | 3 benar, 12 salah | S1 4 kecocokan; S2/S4 masing-masing 3; S5 2. Skor seluruhnya masih di bawah ambang masing-masing. |

Revisi tidak menurunkan ambang model lama secara diam-diam. Pada laporan yang diperkaya, kecocokan berulang di bawah ambang terlihat sebagai dugaan awal. Sesi lama tetap mempunyai status akhir berdasarkan kebijakan lama; versi penjelasan tambahannya ditampilkan. Dugaan awal bukan bukti bahwa setiap pola benar-benar dialami siswa.

## Audit bank

`ml/reports/category_bank_audit.json` memuat semua operasi/kategori/split. Setiap kombinasi memiliki minimal 45 keluarga soal; train memiliki 205–280 keluarga. Seluruhnya cukup untuk 15 soal unik.

Pada kategori puluhan, A3 penjumlahan serta S5 dan S6 pengurangan tidak memiliki kesempatan pengamatan berdasarkan opsi yang tersedia. Ketiganya ditandai tidak terukur, bukan diberi skor nol. Ratusan dan ribuan menyediakan kesempatan bagi seluruh pola, meski jumlahnya tidak seragam. Tidak ada soal atau respons sintetis yang dikarang untuk menambah cakupan.

## Perubahan

- Kategori wajib untuk sesi baru; tidak ada kategori otomatis. Semua soal inti/adaptif dibatasi operand terbesar pada rentang kategori.
- Migrasi tambahan menyimpan kategori dan versi pemilih. Sesi lama diberi kategori null tanpa mengubah soal/respons.
- Diagnosis memisahkan supported, preliminary, ambiguous, insufficient_evidence, not_measurable, dan no_pattern_detected. Kelompok ambigu memerlukan dua kecocokan bersama tanpa pembeda, bukan sekadar skor berdekatan.
- Artefak lama tidak dipakai untuk skor kategori baru. Model kategori belum tersedia sampai pengguna melakukan training/ekspor notebook baru.
- Grafik peringkat beralih ke jumlah kecocokan jika model tidak tersedia. Timeline berisi bukti kumulatif, bukan inferensi model tiap soal. Tidak dikirim ke endpoint siswa.
- KPI dashboard dan hasil siswa memakai komponen bersama. Halaman hasil, detail sesi, serta panduan menggunakan gaya putih, border, tipografi, dan tombol yang konsisten.
- Laporan mengandung versi kebijakan dan fingerprint artefak. Laporan dihitung saat dibaca; model lama tidak ditimpa oleh ekspor kategori baru.

## Pemeriksaan

| Pemeriksaan akhir | Hasil |
|---|---|
| TypeScript | Lulus |
| ESLint (source, bukan build hasil tes) | Lulus |
| Build produksi Next.js | Lulus |
| Tes backend/MySQL/diagnosis/simulator | 12 lulus |
| Tes proxy Express | 1 lulus |
| Browser Edge, guru dan siswa kedua operasi | 1 skenario lulus |
| Struktur dan sintaks notebook | Lulus; sel training tidak dijalankan |


Pemeriksaan mencakup TypeScript, ESLint, build Next.js, sintaks notebook/Python, tes API pada MySQL terisolasi, tes diagnosis terkontrol, dan browser Edge dengan konteks guru/siswa terpisah. Tidak ada training model yang dijalankan.

Tes API meliputi kedua operasi dan tiga kategori, 15 soal unik, inti bersama, soal pembeda, kode/QR/URL, pengiriman ulang/concurrent, refresh, penutupan sesi, kepemilikan guru, migrasi sesi lama, kategori kekurangan soal, serta timeline sama dengan bukti akhir. Tes diagnosis mencakup beberapa pola, satu kesalahan, semua benar, semua dilewati/di luar opsi, kandidat ambigu, pola tidak terukur, dan artefak kompatibel/v1. Pengujian model memakai stub deterministik, bukan artefak training baru.

Tes browser menguji dua operasi pada puluhan, pemilihan kategori wajib, alur 15 soal, respons HTTP hilang setelah diterima server, refresh, hasil guru, grafik, pemilihan nomor soal, serta screenshot desktop dan viewport ponsel 390×844. Pengujian tidak membuka tunnel VS Code atau memakai ponsel fisik.

Runner memilih port kosong dan `.next-test` agar tidak menghentikan layanan aplikasi yang sedang aktif. Database tes dihentikan setelah selesai; database asli hanya dibaca untuk audit. Screenshot berada di `frontend/test-results`, log/database tes di `backend/.local`, keduanya diabaikan Git.

## Menjalankan revisi

1. Dari backend, jalankan `.\.venv\Scripts\python.exe migrate.py`, lalu restart Flask dan Express.
2. Dari frontend, jalankan `npm run build`, lalu restart frontend sesuai mode yang dipakai.
3. Buat sesi baru dan pilih kategori. Sesi lama tetap dapat dilanjutkan.
4. Buka `ml/notebooks/train_kirana_categories.ipynb` untuk simulasi, training, dan evaluasi sendiri. Ekspor default nonaktif. Setelah meninjau evaluasi, aktifkan EXPORT_MODEL dan restart Flask.
5. Sebelum ekspor, bukti aturan tetap tampil; tidak ada skor model kategori buatan.

Reproduksi pemeriksaan dari backend:

```powershell
npm test
.\.venv\Scripts\python.exe tests\run_mysql_tests.py --mysql-bin C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin --browser
```

## Batas evaluasi

Hasil di atas memvalidasi perilaku aplikasi dan konsistensi bukti, bukan akurasi model kategori. Notebook baru belum dijalankan untuk training/evaluasi; `category_evaluation.json` baru dibuat setelah pengguna menjalankannya. Tidak ada klaim akurasi pada siswa nyata.
