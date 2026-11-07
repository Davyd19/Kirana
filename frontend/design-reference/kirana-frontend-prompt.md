# Kirana — Prompt pengembangan frontend (Next.js, tanpa backend)

Kamu bekerja di codebase frontend Kirana yang sudah ada, dibangun dengan **Next.js**. Tugasmu adalah **melengkapi dan merapikan seluruh alur guru dan siswa sebagai aplikasi frontend murni** yang bisa didemokan dari awal sampai akhir di browser. Ini bukan tugas membangun ulang.

**Tidak ada backend pada tahap ini.** Jangan membuat API route, server action, database, atau memanggil layanan eksternal. Semua data berasal dari data tiruan dan disimpan di browser.

Sumber kebenaran, urut prioritas:
1. PRD Kirana (terlampir).
2. Prompt ini.
3. Folder `design-reference/` berisi sumber HTML tiap layar (ID A1–D4) beserta `README.md` yang memetakan setiap layar ke rutenya. Baca README-nya dulu.
4. Kode dan komponen yang sudah ada.

Jika kode existing sudah memenuhi PRD tetapi berbeda dari referensi desain, pertahankan kode existing dan laporkan perbedaannya.

---

## Fase 0 — Audit dulu, jangan langsung mengubah kode

1. Petakan versi Next.js, apakah memakai App Router atau Pages Router, TypeScript, cara styling (Tailwind, CSS Modules, dsb.), state management, data tiruan yang ada, dan komponen yang ada (soal bersusun, opsi, tabel hasil, detail diagnosis).
2. Buat tabel: layar A1–D4 → **sudah ada / perlu diubah / belum ada**, beserta path file terkait.
3. Usulkan rencana per fase dan dependency baru jika ada.
4. **Berhenti dan tunggu persetujuan saya** sebelum masuk Fase 1.

---

## 1. Batasan

- Jangan migrasi framework atau router, jangan refactor besar, dan jangan mengganti identitas visual.
- **Frontend murni.** Tidak ada `app/api/*`, `pages/api/*`, server action, `fetch` ke server, database, atau autentikasi sungguhan.
- Satu sesi berisi satu paket tetap 15 soal unik. Tidak ada pengaturan jumlah soal atau editor soal.
- Tidak ada fitur di luar MVP: multi-organisasi, pembayaran, kurikulum, chat, chatbot, ranking, membuka kembali sesi, ubah kata sandi, atau edit profil.
- Tidak boleh ada tombol, link, atau filter yang terlihat berfungsi tetapi tidak mengubah state.
- Dependency baru hanya jika perlu. Satu-satunya yang kemungkinan dibutuhkan adalah library QR (`qrcode.react` atau `qrcode`) jika belum ada.
- Kategori evaluasi internal (`SINGLE`, `MIXED`, `CORRECT`, `RANDOM`) tidak pernah tampil di UI.

---

## 2. Arsitektur data (tanpa backend)

**Lapisan service.** Semua komponen mengakses data hanya lewat satu modul, misalnya `src/services/kirana.ts`. Isinya fungsi async seperti `createSession`, `getSessionByCode`, `listSessions`, `closeSession`, `registerParticipant`, `saveResponse`, `submit`, `listSubmissions`, dan `getDiagnosis`. Untuk sekarang, implementasinya memanggil `src/mocks/`. Nanti cukup modul ini yang diganti ketika backend siap, jadi komponen tidak perlu berubah.

**Folder `src/mocks/`** adalah satu-satunya tempat untuk hal berikut:
- Bank paket soal Penjumlahan dan Pengurangan (masing-masing minimal satu paket 15 soal), lengkap dengan opsi, kunci jawaban, dan pemetaan opsi ke pola. Ini hanya simulasi backend, jadi **komponen tidak boleh mengimpornya langsung**.
- Diagnoser tiruan sederhana yang deterministik. Ia menghasilkan objek dengan bentuk yang sama dengan kontrak hasil diagnosis di PRD: ringkasan, pola terurut, bukti, kelompok ambigu, dan status kecukupan. Tulis aturan dan ambangnya sebagai konstanta yang jelas di satu file, dan beri komentar bahwa ini placeholder sampai layanan diagnosis tersedia.
- Fixture untuk lima kondisi diagnosis: satu pola, beberapa pola, ambigu, bukti belum cukup, dan tanpa pola. Gunakan data di `design-reference/screens/D2-detail-diagnosis.html` sebagai contoh. Tidak perlu membuat dataset baru jika data demo existing sudah cukup.
- Data awal (seed): akun guru demo dan satu sesi terbuka `KRN-4821` (Pengurangan) dengan 6 submission contoh, sesuai isi referensi desain.

**Penyimpanan.** Gunakan localStorage dengan prefix kunci `kirana:`. Contohnya `kirana:sessions`, `kirana:submissions`, `kirana:auth`, dan `kirana:attempt:<kode>` (berisi `{ pesertaId, nama, respons[], urutanTerakhir }`).
- Akses localStorage hanya di client component (`"use client"`) dan di dalam `useEffect` atau penyimpanan yang aman saat SSR. Ini untuk menghindari hydration mismatch.
- Tampilkan state memuat sampai data dari storage terbaca.
- Sediakan tombol "Reset data demo" di Pengaturan yang mengembalikan seed awal.

**Latensi dan kegagalan tiruan.** Service mock menunggu 300–800 ms agar state loading terlihat. Tambahkan juga flag simulasi gagal yang bisa diatur, misalnya query `?simulasi=gagal` atau toggle di Pengaturan. Flag ini dipakai untuk mendemokan error state pada buat sesi, login, dan pengumpulan.

**Model respons siswa.** Gunakan union eksplisit:
```ts
type Respons =
  | { jenis: "opsi"; soalId: string; opsiId: string }
  | { jenis: "di_luar_opsi"; soalId: string }
  | { jenis: "dilewati"; soalId: string };
```
Opsi bernilai `0` adalah `jenis: "opsi"` biasa. Jangan pernah memakai `null`, `""`, atau `0` sebagai penanda "belum menjawab".

**Login demo.** Kredensial lokal dengan label "Data demo" yang jelas. Halaman `/guru/*` dilindungi di sisi client oleh layout guru: jika belum login, redirect ke `/login`. Jangan memakai middleware, karena tidak ada sesi server.

**Keterbatasan yang harus diterima.** Karena data ada di localStorage, data hanya tersedia di satu browser di satu perangkat.
- Siswa yang memindai QR dari HP lain tetap bisa mengerjakan `KRN-4821`, karena sesi itu ada di seed. Tetapi submission-nya tidak akan muncul di laptop guru.
- Untuk demo alur penuh, gunakan **tab biasa di browser yang sama**, bukan mode privat (mode privat memakai storage terpisah).
- Sesi baru yang dibuat guru hanya bisa dibuka siswa di browser yang sama.
- Tampilkan catatan singkat soal ini di halaman detail sesi saat mode demo.

---

## 3. Rute (Next.js)

Gunakan App Router jika proyek sudah memakainya. Kalau tidak, ikuti router existing. Route group boleh dipakai untuk memisahkan layout.

| Publik `(public)` | Guru `(guru)`, layout dengan sidebar | Siswa `(siswa)`, tanpa login |
|---|---|---|
| `/` landing (A1) | `/guru/dashboard` (B1) | `/kuis/[kode]` isi nama (C1) |
| `/login` (A2) | `/guru/sesi` (B2) | `/kuis/[kode]/kerjakan/[urutan]` (C2) |
| `/join` (A3) | `/guru/sesi/buat` (B3) | `/kuis/[kode]/konfirmasi` (C3) |
| | `/guru/sesi/[sessionId]` (B4) | `/kuis/[kode]/selesai` (C3, berhasil) |
| | `/guru/hasil` · `/guru/hasil/[sessionId]` (D1) | |
| | `/guru/hasil/[sessionId]/siswa/[pesertaId]` (D2) | |
| | `/guru/panduan` (D3) · `/guru/pengaturan` (D4) | |

- QR dan tautan dibuat dari `window.location.origin + "/kuis/" + kode`, bukan URL hardcode.
- Rute lama yang berbeda di-redirect, jangan dihapus.
- Gunakan `next/link` untuk semua navigasi dan `useRouter().push` setelah aksi berhasil, misalnya setelah buat sesi selesai, pindah ke detail sesi.

---

## 4. Desain: token dan komponen

Ambil nilai persis dari `design-reference/`. Jika memakai Tailwind, masukkan token ke `tailwind.config` atau CSS variables di `globals.css`. Jika tidak, gunakan CSS variables.

**Warna**

| Token | Nilai | Pemakaian |
|---|---|---|
| primary | `#2448B8` | tombol utama, tautan, status terpilih |
| primary-hover | `#16307F` | hover tautan |
| primary-soft | `#E8EDFB` | latar opsi terpilih, badge pola |
| primary-ink | `#1B3A99` | teks di atas primary-soft |
| bg | `#F5F6F8` | latar halaman |
| surface | `#FFFFFF` | kartu |
| border | `#D9DEE7` | garis kartu |
| border-strong | `#C5CCD8` | input, tombol sekunder |
| divider | `#EEF0F4` | garis baris tabel |
| ink | `#141B2D` | teks utama, tombol gelap |
| ink-2 | `#313A4E` | teks sekunder kuat |
| muted | `#4A5468` | teks keterangan |
| disabled | `#DDE2EA` | latar tombol nonaktif |
| success | `#17633A` | teks sukses / status Terbuka (latar `#E6F4EC`) |
| danger | `#9B1C1C` | teks error / tombol Tutup Sesi (latar `#FDECEC`) |
| luar-opsi | `#A84A0B` | penanda "hasil di luar opsi", label Data demo (teks gelap `#7A3606`, latar `#FFF3E8`) |

**Tipografi.** Gunakan `next/font/google`:
- **Plus Jakarta Sans** (400–800) untuk UI.
- **IBM Plex Mono** (500, 600) untuk semua angka: soal, opsi, kode sesi, dan jumlah.
- Ukuran soal bersusun memakai `clamp(44px, 7vw, 60px)` dengan `font-variant-numeric: tabular-nums`.

**Radius:** 8px (badge), 10–12px (input, tombol), 14px (opsi jawaban), 16px (kartu), 20px (kartu siswa), 999px (pill).

**Ukuran:**
- Tombol 44–56px. Input 48–56px. Opsi jawaban 80px.
- Semua target sentuh minimal 44px.

**Breakpoint:**

| Lebar | Perubahan |
|---|---|
| ≤600px | Halaman siswa dan login menjadi penuh layar: tanpa bingkai kartu, latar putih, tombol aksi menempel di bawah dengan `env(safe-area-inset-bottom)`. |
| ≤700px | Tabel berubah menjadi kartu. Grid ringkasan 4 kolom menjadi 2 kolom. |
| ≤860px | Navbar landing berubah menjadi menu hamburger. |
| ≤900px | Sidebar guru berubah menjadi bar atas dengan menu yang bisa digeser horizontal. |

**Komponen reusable minimal:** `SoalBersusun`, `OpsiJawaban`, `TombolLuarOpsi`, `StatusBadge` (Terbuka/Ditutup), `LabelDiagnosis`, `KartuPola`, `KartuStat`, `DataDemoBadge`, `GuruLayout` (sidebar), `SiswaLayout` (kartu tengah / penuh layar), `Dialog` (dengan focus trap dan Esc), `QrSesi`, `EmptyState`, dan `ErrorBanner`.

**Status terpilih** ditandai border 3px, ikon centang, dan teks "Dipilih" sekaligus, tidak hanya warna. Hindari gradient, animasi dekoratif, emoji, dan kartu dengan aksen garis kiri.

---

## 5. Layar target

Detail visual tiap layar ada di `design-reference/screens/`. Ringkasan perilakunya:

- **A1 Landing:** navbar, hero dengan 2 CTA, cara kerja 4 langkah, keunggulan, tentang, footer.
- **A2 Login:** validasi field kosong, toggle tampilkan kata sandi, loading, error, kembali ke beranda.
- **A3 Masuk kuis:** validasi kode kosong, kode tidak ditemukan, sesi ditutup, dan gangguan koneksi (simulasi). Kode valid lanjut ke C1.
- **B1 Dashboard:** 4 kartu ringkasan yang dihitung dari store, sesi terbaru, kartu "hasil diagnosis adalah dugaan", empty state.
- **B2 Daftar sesi:** cari kode, filter operasi dan status yang benar-benar menyaring, terbaru di atas, state memuat, kosong, dan tidak ada hasil.
- **B3 Buat sesi:**
  - Alurnya: pilih operasi, lalu info paket, lalu konfirmasi.
  - Tombol nonaktif sampai operasi dipilih dan terkunci saat loading (anti klik ganda).
  - Jika gagal, tampilkan error dan tombol coba lagi. Jika berhasil, `router.push` ke B4.
  - **QR, kode, dan tautan tidak tampil sebelum sesi berhasil dibuat.**
  - Kode sesi dibuat dengan format `KRN-####` dan harus unik di store.
- **B4 Detail sesi:**
  - QR asli, salin kode/tautan dengan feedback, unduh QR (PNG dari canvas QR), dan layar penuh.
  - Pengumpulan dengan tombol Muat ulang. Jangan mengklaim real-time.
  - Dialog Tutup Sesi. Setelah ditutup, status di store berubah, panel bagikan diganti keterangan, dan `/kuis/[kode]` menolak peserta baru.
- **C1 Isi nama:** tampilkan operasi dan jumlah soal. Nama wajib diisi. Tampilkan state sesi ditutup dan kode tidak valid. Peserta yang sudah terdaftar di browser ini langsung lanjut ke soal terakhirnya.
- **C2 Soal:**
  - Satu soal per layar dengan progres "Soal n dari 15". Soal bersusun dengan digit sejajar.
  - 4 opsi tampil 2×2 di HP dan sejajar di desktop, dengan posisi tetap dari paket.
  - Sediakan "Hasil saya tidak ada di pilihan" dan "Lewati". Pilihan bisa diganti sebelum Lanjut.
  - Setiap respons langsung disimpan ke storage. Jawaban benar tidak ditampilkan.
- **C3 Konfirmasi dan selesai:**
  - Tampilkan jumlah memilih jawaban, di luar opsi, dan dilewati (totalnya 15), dengan tombol kembali ke soal yang dilewati.
  - Jika pengumpulan gagal, tampilkan tombol coba lagi tanpa kehilangan jawaban. Jika berhasil, tampilkan "Jawabanmu sudah dikumpulkan."
  - Tidak ada diagnosis untuk siswa.
- **D1 Hasil:** pilih sesi, tabel siswa dengan 4 jumlah (totalnya 15) dan label diagnosis, kartu di HP, empty state.
- **D2 Detail diagnosis:**
  - Tampilkan semua pola sesuai urutan dari service, dengan bukti "x dari y kesempatan", contoh soal, dan saran pemeriksaan.
  - Tampilkan kelompok ambigu dengan soal pembeda, status bukti belum cukup beserta alasannya, dan "Belum ada pola yang terdeteksi pada sesi ini." hanya jika cakupan memadai.
  - Sediakan pemilih fixture (hanya di mode demo) untuk menampilkan kelima kondisi.
- **D3 Panduan:** accordion 6 bagian.
- **D4 Pengaturan:** profil demo, Keluar, Reset data demo.

**Bahasa diagnosis.** Gunakan "dugaan pola kesalahan", "bukti pendukung", "kemungkinan ambigu", dan "perlu pemeriksaan lanjutan". Jangan memakai "pasti", "diagnosis final", atau "tidak memahami".

**Teks state.** Gunakan apa adanya:
- "Belum ada sesi kuis. Buat sesi pertamamu untuk mulai mengamati hasil pengerjaan siswa."
- "Sesi berhasil dibuat. Bagikan kode atau QR kepada siswa."
- "Sesi belum berhasil dibuat. Silakan coba lagi."
- "Kode kuis tidak ditemukan. Periksa kembali kode yang dimasukkan."
- "Sesi kuis ini sudah ditutup oleh guru."
- "Jawaban belum berhasil dikumpulkan. Pilihanmu tetap tersimpan, silakan coba lagi."
- "Jawabanmu sudah dikumpulkan."

---

## 6. Aksesibilitas

- HTML semantik. Setiap input punya `<label>`. Error ditautkan dengan `aria-describedby` dan diumumkan dengan `role="alert"`. Loading memakai `aria-busy` atau `role="status"`.
- Focus ring terlihat. Semua aksi bisa dipakai dengan keyboard. Dialog punya focus trap dan bisa ditutup dengan Esc.
- Kontras teks minimal 4.5:1. Tidak ada scroll horizontal pada body di lebar 360px.

---

## 7. Urutan kerja

Setiap fase diakhiri commit dan laporan singkat.

1. **Fase 1 — Fondasi:** token desain dan font, `src/mocks/` beserta seed, service layer, store localStorage, layout guru dan siswa, A1, A2.
2. **Fase 2 — Kelola sesi:** B3, B4, B2, B1.
3. **Fase 3 — Siswa:** A3, C1–C3, terhubung ke sesi di store.
4. **Fase 4 — Hasil:** D1, D2 (diagnoser tiruan dan 5 fixture), D3, D4, lalu perapian responsif dan aksesibilitas.

---

## 8. Definisi selesai

Jalankan `npm run build` (atau perintah setara di `package.json`), lint, dan typecheck. Semuanya harus lulus tanpa error dan tanpa peringatan hydration di console.

Lalu uji manual dengan `npm run dev` di **satu browser, tab biasa**:

1. Buka `/`, lalu Masuk sebagai Guru, login, dan pastikan masuk ke dashboard.
2. Buat sesi Pengurangan. Klik dua kali cepat dan pastikan hanya satu sesi yang tercipta. Pastikan redirect ke detail sesi dan QR tampil.
3. Buka tautan sesi di tab baru (siswa A). Isi nama, kerjakan semua soal dengan minimal satu jawaban `0`, satu "di luar opsi", dan satu "dilewati". Refresh di soal 7 dan pastikan jawaban tetap ada. Kumpulkan dengan simulasi gagal satu kali, lalu berhasil.
4. Ulangi sebagai siswa B lewat `/join`. Pastikan paket dan urutan soal sama dengan siswa A.
5. Kembali ke tab guru dan tekan Muat ulang. Kedua submission muncul, jumlah 4 kategori = 15, dan ketiga jenis respons tetap terpisah.
6. Buka D2 dan tampilkan kelima kondisi diagnosis.
7. Tutup sesi. Pastikan status berubah di B1, B2, dan B4, dan `/kuis/[kode]` menolak peserta baru.
8. Reset data demo di D4 dan pastikan seed kembali.
9. Cek lebar 360, 768, dan 1280px. Pastikan tidak ada dead link dan back/forward browser tetap masuk akal.

---

## 9. Laporan akhir

Laporan berisi:
- Halaman dan komponen yang dibuat atau diubah, beserta path file.
- Isi `src/mocks/` dan fungsi service yang nantinya perlu diganti dengan backend, sebagai daftar kebutuhan kontrak API berikutnya.
- Hasil build/lint/typecheck dan checklist bagian 8, termasuk yang gagal.
- Penyimpangan dari referensi desain beserta alasannya.
