# Kirana — demo terintegrasi

Tiga bagian aplikasi:

- `frontend/`: Next.js, tampilan guru dan siswa pada port 3000.
- `backend/`: Express pada port 3001, Flask pada port 5000, penyimpanan MySQL.
- `ml/`: dataset, training, notebook, dan artefak diagnosis. Training tidak berjalan saat kuis.

Browser → `/api` Next.js → Express → Flask → MySQL dan inferensi ML.

Mulai dari [panduan backend](backend/README.md) untuk database, migrasi, dan seeder, lalu [panduan frontend](frontend/README.md). Kontrak API ada di [backend/API.md](backend/API.md). [VALIDATION.md](VALIDATION.md) mencatat hasil pemeriksaan dan uji manual demo.

Guru membuat sesi satu operasi, siswa bergabung lewat kode/QR/URL tanpa akun. Setiap siswa mendapat 9 soal inti dan 6 soal adaptif. Jawaban dikunci setelah Lanjut. Hasil disimpan di server; perangkat guru dan siswa tidak perlu berbagi browser.

Model memakai data sintetis. Hasil diagnosis belum membuktikan akurasi pada siswa nyata.
