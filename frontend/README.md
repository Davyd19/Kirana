# Frontend Kirana

Frontend memakai API nyata melalui `/api`. Tidak ada akun palsu, peserta contoh, atau kunci jawaban di bundle siswa.

## Menjalankan Windows

Siapkan MySQL, migrasi, seeder, Express, dan Flask sesuai [panduan backend](../backend/README.md).

```powershell
cd 'C:\Davyd\Kirana\Source Code\Kirana\frontend'
npm ci
npm run build
npm start
```

Untuk mengembangkan tampilan gunakan `npm run dev`. Keduanya menggunakan port 3000; jangan jalankan bersamaan.

`.env.local` (sudah tersedia lokal; pada checkout baru salin `.env.example`):

```dotenv
KIRANA_EXPRESS_URL=http://127.0.0.1:3001
```

Variabel tersebut hanya digunakan server Next.js, bukan alamat API publik browser. Jika nilainya berubah, build ulang frontend. Tidak perlu mengubahnya ketika alamat Forward Ports berubah.

Buka `http://localhost:3000/login` untuk guru atau `/join` untuk siswa yang memasukkan kode. QR/URL membuka `/join/:token` lalu halaman nama panggilan pada sesi yang sama. Login guru menggunakan kredensial seeder dari backend `.env`.

Untuk demo ponsel melalui VS Code, forward port 3000 lalu sesuaikan `KIRANA_FRONTEND_URL` backend dengan URL publik HTTPS. Panduan lengkap ada di backend.

## Perilaku

- Pilihan siswa dapat diganti sebelum Lanjut; sesudah diterima server jawaban terkunci.
- Refresh memuat ulang soal, opsi, dan progres dari MySQL. Browser menyimpan token akses siswa, bukan sumber kebenaran jawaban.
- Jika koneksi gagal, pilihan tetap di layar dan pengiriman dapat diulang. Jangan menghapus penyimpanan browser sebelum selesai.
- Penutupan sesi hanya menolak peserta baru; siswa yang sudah mulai dapat menyelesaikan 15 soal.
- Halaman guru memperbarui data tiap 5 detik ketika tab terlihat.
- Diagnosis belum tersedia berbeda dari bukti belum cukup. Tidak ada diagnosis contoh sebagai pengganti model.

## Pemeriksaan

```powershell
npm run typecheck
npm run lint
npm run build
```

Pengujian browser memakai runner MySQL terisolasi di backend dengan opsi `--browser`, bukan database demo. Lihat `tests/integration.spec.ts`.


## Laporan dan kategori v2

Guru wajib memilih Puluhan/Ratusan/Ribuan berdasarkan operand terbesar. Soal inti dan adaptif tetap berada dalam kategori tersebut. Dashboard dan detail siswa memakai komponen KPI yang sama; Hasil & Diagnosis serta Panduan memakai desain putih yang konsisten.

Laporan membedakan pola didukung, dugaan awal, kandidat yang belum bisa dibedakan, dan pola tidak terukur. Grafik batang menggunakan skor model hanya jika tersedia; jika tidak, satuannya jumlah kecocokan. Grafik garis adalah perkembangan bukti kumulatif, bukan probabilitas per soal. Pilih checkbox pola, titik, atau nomor soal; tabel angka tersedia sebagai alternatif visual.

Tes browser menggunakan port kosong otomatis dan `.next-test`, sehingga aplikasi demo pada port biasa dapat tetap berjalan. Pengujian meliputi desktop dan viewport ponsel; tunnel/ponsel fisik tetap perlu pemeriksaan manual.
