# PRD Frontend Kirana

Gunakan dokumen ini sebagai konteks untuk merancang frontend Kirana dalam bahasa Indonesia. Periksa struktur proyek dan komponen yang sudah tersedia sebelum mengusulkan perubahan. Jika layanan backend belum siap, gunakan data tiruan berlabel **“Data demo”** untuk mendemokan alur lengkap.

## Tujuan produk

Kirana membantu guru melihat bagian dari penjumlahan atau pengurangan bersusun yang perlu ditinjau bersama setiap siswa. Siswa mengerjakan kuis pilihan ganda sebagai tamu. Guru melihat dugaan pola kesalahan, jawaban yang mendukung dugaan, dan saran pemeriksaan lanjutan.

## Alur dan layar utama

### 1. Guru membuat sesi kuis

- Guru memilih **Penjumlahan** atau **Pengurangan**.
- Setelah sesi dibuat, tampilkan kode dan tautan yang bisa disalin untuk dibagikan ke siswa.
- Asumsi MVP saat ini adalah satu kode kuis menggunakan satu paket tetap berisi **15 soal unik** yang dipilih sebelum pengerjaan dimulai. Semua siswa pada kode yang sama mendapat paket yang sama. Sesi baru dapat memakai paket lain.
- Frontend menerima paket dan opsi dari backend. Paket sudah disusun untuk memberi kesempatan mengamati beberapa pola pada operasi tersebut.

### 2. Siswa bergabung sebagai tamu

- Siswa masuk melalui tautan atau memasukkan kode kuis secara manual, tanpa membuat akun.
- Minta nama panggilan atau kode siswa sesuai kebutuhan kelas agar guru bisa mengenali hasilnya.
- Sebelum siswa mulai, tampilkan operasi yang akan dikerjakan dan jumlah soal. Beri pesan yang jelas jika kode salah atau sesi sudah ditutup.

### 3. Siswa mengerjakan kuis

- Tampilkan **satu soal per layar** dengan progres, misalnya **“Soal 4 dari 15”**.
- Tampilkan soal secara **bersusun vertikal**. Angka rata kanan, digit dengan nilai tempat yang sama sejajar, dan tanda operasi tampil di kiri baris bawah.
- Di bawah soal, tampilkan **empat opsi angka yang berbeda**. Posisi jawaban benar dapat bervariasi antarsoal. Opsi yang sudah diterima untuk soal tersebut tetap pada posisi yang sama saat layar dimuat kembali.
- Siswa bisa mengganti pilihannya sebelum menekan **Lanjut**. Sediakan dua tindakan yang berbeda dari opsi angka:
  - **Hasil saya tidak ada di pilihan** untuk siswa yang sudah menghitung tetapi hasilnya tidak tersedia.
  - **Lewati** untuk soal yang tidak dijawab.
- Jawaban `0` adalah pilihan numerik yang sah. Simpan pilihan angka, hasil di luar opsi, dan soal yang dilewati sebagai tiga jenis respons yang berbeda.
- Selama pengerjaan, tampilkan progres tanpa membuka jawaban benar atau dugaan pola. Pada akhir kuis, tampilkan konfirmasi pengumpulan, termasuk jumlah soal yang dilewati. Setelah berhasil, tampilkan **“Jawabanmu sudah dikumpulkan.”**

Contoh tata letak siswa:

```text
             Soal 4 dari 15

                   71
                 − 38
                 ────
                    ?

            [ 43 ]   [ 32 ]
            [ 33 ]   [ 47 ]

       Hasil saya tidak ada di pilihan

             Lewati     Lanjut
```

### 4. Guru melihat hasil

Tampilkan daftar siswa yang sudah mengumpulkan jawaban. Guru bisa membuka detail satu siswa dan melihat:

- **Ringkasan sesi.** Tampilkan operasi serta jumlah jawaban benar, pilihan angka yang salah, hasil di luar opsi, dan soal yang dilewati. Keempat jumlah tersebut mencakup seluruh 15 soal.
- **Pola yang didukung.** Tampilkan **semua dugaan pola yang punya cukup bukti**, mengikuti urutan dari layanan diagnosis. Gunakan nama yang mudah dipahami, misalnya **“Lupa mengurangi angka setelah meminjam.”**
- **Bukti dan tindak lanjut.** Untuk tiap pola, tampilkan jumlah jawaban pendukung, kesempatan diagnostik yang sesuai, contoh soal beserta pilihan siswa dan jawaban benar, serta satu saran pemeriksaan. Contohnya, **“Minta siswa menunjukkan angka mana yang berubah setelah meminjam.”**
- **Kemungkinan ambigu.** Jika pilihan yang sama cocok dengan lebih dari satu pola dan bukti lain belum membedakannya, kelompokkan kemungkinan itu dan tampilkan soal pembeda jika tersedia.
- **Bukti belum cukup.** Jelaskan alasannya jika diketahui, misalnya beberapa soal yang relevan dilewati. Gunakan **“Belum ada pola yang terdeteksi pada sesi ini”** ketika layanan diagnosis menyatakan cakupan pengamatan memadai dan belum menemukan pola.

Kategori simulasi seperti `SINGLE`, `MIXED`, `CORRECT`, dan `RANDOM` digunakan untuk evaluasi internal. Guru melihat dugaan prosedur dan jawaban yang mendukungnya.

## Data yang dibutuhkan frontend

Sepakati kontrak akhirnya dengan tim backend. Gunakan struktur berikut untuk data demo dan integrasi awal.

| Bagian | Data yang dibutuhkan |
|---|---|
| Sesi kuis | ID sesi, kode atau tautan bergabung, operasi, status sesi, dan jumlah soal. |
| Soal siswa | ID dan urutan soal, dua operand, tanda operasi, serta empat opsi dengan ID dan nilai masing-masing. |
| Pengumpulan | ID peserta tamu, ID soal, serta jenis respons berupa opsi terpilih, hasil di luar opsi, atau dilewati. Untuk opsi terpilih, kirim ID opsi. |
| Hasil guru | Ringkasan sesi, daftar pola yang didukung dan sudah diurutkan, jumlah bukti, contoh respons, kelompok ambigu jika ada, dan saran tindak lanjut. |

Simpan kunci jawaban, pemetaan opsi ke pola, dan ambang diagnosis di backend. Frontend mengikuti urutan dan status bukti dari layanan diagnosis.

## Kriteria penerimaan

- Guru dapat membuat sesi dan membagikan kode. Siswa dapat bergabung sebagai tamu, mengerjakan 15 soal, dan mengumpulkan jawaban.
- Dua siswa yang masuk dengan kode yang sama menerima paket soal yang sama sesuai asumsi MVP.
- Soal bersusun tetap sejajar dan mudah dibaca di ponsel serta desktop. Pilihan bisa digunakan dengan sentuhan dan keyboard, dan status pilihan terlihat tanpa bergantung pada warna.
- Jawaban `0`, hasil di luar opsi, dan soal yang dilewati tetap berbeda dari layar kuis sampai ringkasan guru.
- Dasbor dapat mendemokan satu pola, beberapa pola yang sama-sama didukung, kemungkinan ambigu, bukti belum cukup, dan sesi tanpa pola terdeteksi.
- Tampilkan keadaan memuat, kode sesi tidak valid, dan pengumpulan gagal. Jika pengumpulan gagal, siswa bisa mencoba lagi dengan pilihan yang sudah diisi.

---

## Catatan tahap saat ini (hackathon, frontend saja)

Bagian ini melengkapi PRD di atas untuk tahap pengembangan sekarang.

- **Belum ada backend.** Semua bagian yang menyebut "dari backend" atau "layanan diagnosis" disimulasikan di `src/mocks/` dan diakses lewat satu lapisan service, sesuai `kirana-frontend-prompt.md`. Kunci jawaban, pemetaan opsi ke pola, dan ambang diagnosis tiruan hanya boleh ada di `src/mocks/`, tidak di komponen. Aturan "simpan di backend" tetap berlaku saat backend tersedia.
- **Pembagian sesi.** Setelah sesi berhasil dibuat, sistem menampilkan QR, tautan, dan kode. QR dan tautan membuka halaman tempat siswa mengisi nama lalu langsung mulai mengerjakan.
- **Identitas siswa.** Siswa tidak membuat akun, tetapi nama panggilan atau kode siswa wajib diisi sebelum mulai.
- **Tampilan siswa.** Berupa web responsif, bukan aplikasi mobile. Di layar HP, halaman siswa tampil penuh layar.
