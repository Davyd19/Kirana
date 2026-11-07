# Referensi desain Kirana

Folder ini berisi **sumber HTML asli** dari kanvas desain Kirana, satu file per layar. Gunakan sebagai acuan tampilan saat mengimplementasikan di Next.js, bukan sebagai kode untuk disalin langsung.

## Cara membaca file

- Setiap file adalah satu layar. Gaya ditulis inline (`style="..."`), sehingga warna, ukuran, jarak, dan radius bisa dibaca persis.
- Sintaks khusus kanvas yang **tidak perlu ditiru**:
  - `{{nama}}` adalah nilai dinamis dari state.
  - `<sc-if value="{{x}}">` adalah render bersyarat. Di React menjadi `{x && ...}`.
  - `<sc-for list="{{items}}" as="i">` adalah perulangan. Di React menjadi `items.map(...)`.
  - `class Component extends DCLogic` di bagian bawah berisi state dan data demo. Data di sini boleh dipakai sebagai contoh isi fixture.
- Aturan responsif ada di blok `<style>` di bagian atas file (`@media`).

## Peta layar

| ID | File | Rute Next.js |
|---|---|---|
| A1 | screens/A1-landing.html | `/` |
| A2 | screens/A2-login-guru.html | `/login` |
| A3 | screens/A3-masuk-kuis.html | `/join` |
| B1 | screens/B1-dashboard.html | `/guru/dashboard` |
| B2 | screens/B2-daftar-sesi.html | `/guru/sesi` |
| B3 | screens/B3-buat-sesi.html | `/guru/sesi/buat` |
| B4 | screens/B4-detail-sesi.html | `/guru/sesi/[sessionId]` |
| C1 | screens/C1-siswa-isi-nama.html | `/kuis/[kode]` |
| C2 | screens/C2-siswa-soal.html | `/kuis/[kode]/kerjakan/[urutan]` |
| C3 | screens/C3-siswa-konfirmasi.html | `/kuis/[kode]/konfirmasi` dan `/kuis/[kode]/selesai` |
| D1 | screens/D1-hasil-sesi.html | `/guru/hasil` dan `/guru/hasil/[sessionId]` |
| D2 | screens/D2-detail-diagnosis.html | `/guru/hasil/[sessionId]/siswa/[pesertaId]` |
| D3 | screens/D3-panduan.html | `/guru/panduan` |
| D4 | screens/D4-pengaturan.html | `/guru/pengaturan` |

Folder `screenshots/` (opsional) bisa diisi tangkapan layar dari kanvas untuk referensi visual tambahan.
