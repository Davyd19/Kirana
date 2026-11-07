# Kontrak API Kirana

Frontend memanggil `/api` pada origin yang sama. JSON untuk body, `credentials: same-origin` untuk guru, Bearer untuk siswa. Error berbentuk `{ "error": "...", "message": "..." }`. Semua respons `Cache-Control: no-store`.

## Guru

| Metode dan endpoint | Input / hasil |
|---|---|
| POST `/api/auth/login` | `{ "email": "...", "password": "..." }`; cookie HttpOnly + `{ guru: { nama, email }, masukPada }` |
| GET `/api/auth/me` | Guru aktif; 401 jika sesi habis |
| POST `/api/auth/logout` | Hapus sesi login dan cookie |
| POST `/api/sessions` | `{ "operation": "addition", "number_category": "tens" }` (operation juga menerima `subtraction`, kategori juga `hundreds`/`thousands`)`; 201 detail sesi |
| GET `/api/sessions` | `{ sessions: [...] }`, hanya sesi guru aktif |
| GET `/api/sessions/:id` | Detail sesi |
| POST `/api/sessions/:id/close` | Detail sesi berstatus closed; pengulangan aman |
| GET `/api/sessions/:id/results` | `{ session_id, operation, results: [...] }`, hanya peserta yang sudah mengumpulkan |
| GET `/api/sessions/:id/results/:attemptId` | Satu hasil lengkap |

Detail sesi: `session_id`, `operation`, `code`, `question_count: 15`, `status: open|closed`, `created_at`, `closed_at`, `participant_count`, `submission_count`, `join_url`, `join_qr_svg`. Tanggal ISO UTC. Kode `KRN-XXXXXX`, token URL acak terpisah. Guru tidak lagi menggunakan teacher_token per sesi; otorisasi berdasarkan cookie login dan kepemilikan database.

Cookie berlaku 12 jam; HttpOnly, SameSite=Lax, Path=/api, Secure jika alamat publik HTTPS. Permintaan perubahan dari origin lain ditolak. Tanpa login: 401; sesi guru lain: 404. Token siswa tidak dapat menggantikan cookie guru.

## Siswa

| Metode dan endpoint | Input / hasil |
|---|---|
| POST `/api/join/resolve` | `{ "code": "KRN-ABC234" }` → `{ token, code }` |
| GET `/api/join/:token` | `{ operation, question_count, code, status }` |
| POST `/api/join/:token` | `{ "nickname": "Ayu" }` → 201 `{ attempt_id, student_token, operation, question_count, question }` |
| GET `/api/attempts/:id/current` | `{ question, ready_to_finish, submitted }` |
| GET `/api/attempts/:id/progress` | `{ attempt_id, nickname, submitted_at, submitted, questions, responses }` |
| PUT `/api/attempts/:id/responses/:position` | Respons di bawah → `{ accepted_position, question, ready_to_finish }` |
| POST `/api/attempts/:id/finish` | `{ submitted: true }`; memerlukan 15 respons |

Semua endpoint attempts memerlukan `Authorization: Bearer <student_token>`. Posisi 1–15. `questions` hanya berisi soal yang sudah diterbitkan, termasuk soal aktif, bukan soal lanjutan yang belum dipilih.

```json
{"kind":"selected","option_id":"0"}
```

Alternatif `{ "kind": "outside_options" }` atau `{ "kind": "skipped" }`. ID opsi berupa string 0–3. Opsi sudah disimpan sebelum dikirim. Respons identik yang diulang mengembalikan hasil sama; respons berbeda pada posisi yang telah dijawab menghasilkan 409. Sesi ditutup menghasilkan 409 untuk peserta baru, tetapi tidak menghentikan attempts yang ada.

Soal publik: `{ id, position, operation, operand_1, operand_2, options: [{id,value}, ...] }`, tepat empat opsi tanpa kunci atau pemetaan pola. Progres `responses`: `{position, kind, option_id}`. Siswa baru perlu token baru; nama panggilan tidak harus unik.

## Laporan dan diagnosis

Hasil: `attempt_id`, `nickname`, `submitted_at`, `summary: {correct, wrong, outside_options, skipped}`, `answers`, `diagnosis`. Skor adalah `summary.correct` dari 15. Empat hitungan selalu berjumlah 15.

`answers` hanya untuk guru: `position`, `operand_1`, `operand_2`, `selected_value` (nullable), `correct_value`, `kind` (correct/wrong/outside_options/skipped).

Diagnosis `status`: supported, insufficient_evidence, no_pattern_detected, unavailable. `patterns` memuat semua pola yang didukung, dengan skor model, kecocokan, kesempatan, contoh, dan saran pemeriksaan. Skor model bukan ukuran akurasi siswa nyata. `patterns: []` tidak otomatis berarti siswa menguasai semua materi. Status unavailable tidak mengganti hasil dengan baseline/demo.

`GET /api/health` menghasilkan `{ status: "ok", diagnosis_available: boolean }`; ini menunjukkan layanan dan artefak saat startup, bukan pemeriksaan MySQL terus-menerus.


## Revisi kategori dan bukti v2

`POST /api/sessions` wajib menyertakan `number_category` tanpa default. Kategori berdasarkan operand terbesar: tens 10–99, hundreds 100–999, thousands 1000–9999. Hasil boleh melampaui rentang. Backend menolak kategori dengan kurang dari 15 keluarga soal. Seluruh 9 inti dan 6 adaptif dibatasi kategori sesi.

Detail sesi dan GET join menyertakan `number_category` serta `quiz_policy_version`. Sesi lama memiliki kategori null dan kebijakan adaptive-v1; respons tersimpan tidak diubah. Sesi baru menggunakan adaptive-category-v2.

Diagnosis menambahkan:

- `pattern_assessments`: seluruh pola dengan `status`, `reasons`, skor/ambang nullable, matching_answers, distinguishing_answers, shown_opportunities, answered_opportunities, dan examples.
- Status per pola: supported, preliminary, ambiguous, insufficient_evidence, not_measurable, no_pattern_detected.
- `ambiguous_groups`: pasangan kandidat dengan minimal dua kecocokan bersama dan tanpa kecocokan pembeda; bukan klaim siswa mengalami keduanya.
- `model_compatibility`: compatible, category_model_unavailable, atau unavailable.
- `diagnosis_policy_version`: evidence-status-v2 untuk kategori; legacy-v1+evidence-v2 untuk sesi lama. Status akhir sesi lama mengikuti aturan lama, dengan penjelasan bukti tambahan yang diberi versi.
- `patterns` tetap hanya pola didukung. Status ringkasan baru dapat berupa preliminary atau ambiguous.

Detail satu siswa menambahkan `evidence_timeline` (15 posisi), masing-masing berisi soal, respons, kecocokan kumulatif, pembeda kumulatif, serta new_distinguishing. Endpoint daftar hasil tidak memuat timeline. Kedua laporan menyertakan `quiz_policy_version` dan `model_artifact_sha256` nullable untuk mengetahui artefak yang dipakai. Laporan dihitung dari respons tersimpan pada saat dibaca; pergantian artefak ditandai oleh fingerprint dan bukan perubahan jawaban siswa.

Grafik menggunakan skor model hanya jika artefak kompatibel. Nilai null bukan nol. Kategori yang belum dilatih tetap dapat memberikan dugaan awal berbasis aturan dengan minimal dua kecocokan; tidak menghasilkan status supported.
