# Machine learning Kirana

Folder ini berisi simulasi pilihan ganda, training, dan prediksi. [Backend](../backend/README.md) tetap mengelola sesi kuis, menyimpan respons, dan memanggil prediksi untuk laporan guru. Training berjalan sebagai tugas terpisah. Saat melayani kuis, Flask memuat model langsung dari file.

| Lokasi | Isi |
|---|---|
| `notebooks/train_kirana.ipynb` | Satu alur audit, simulasi, training, evaluasi, dan ekspor. |
| `train.py` dan `unified_training.py` | Perintah dan alur training dari terminal. `training.py` dan `category_training.py` adalah fungsi simulasi untuk dua kebijakan kuis. |
| `diagnosis.py` | Pemuatan model dan prediksi pola. |
| `simulation.py` | Prosedur penjumlahan dan pengurangan serta simulasi respons. |
| `dataset/` | Empat CSV dataset sintetis Kirana. |
| `reports/evaluation.json` | Metrik validation dan test, seed, versi paket, dan hash sumber. |
| `artifacts/kirana_model.joblib` | Satu artefak deployment berisi cabang sesi lama dan kategori baru. |

## Menjalankan di Windows

Dari folder repositori, buat lingkungan Python khusus training jika diperlukan.

```powershell
py -3.13 -m venv ml\.venv
.\ml\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
.\ml\.venv\Scripts\python.exe ml\train.py
```

Untuk membuka notebook di JupyterLab:

```powershell
.\ml\.venv\Scripts\python.exe -m pip install jupyterlab==4.3.5 ipykernel==6.29.5
.\ml\.venv\Scripts\python.exe -m jupyterlab
```

Buka [notebook Kirana](notebooks/train_kirana.ipynb), lalu jalankan sel berurutan. `EXPORT_MODEL = False` secara bawaan. Periksa laporan validation dan test sebelum mengubahnya menjadi `True` dan menjalankan sel ekspor. Dari terminal, `ml/train.py` menjalankan evaluasi saja; tambahkan `--export` untuk menulis model.

Model gabungan memuat dua estimator per operasi: cabang `legacy` memakai kebijakan sesi lama, cabang `category` memakai ambang Puluhan/Ratusan/Ribuan. Jika model v1 lokal tersedia, notebook menyalin estimator dan ambang itu tanpa melatih ulang cabang lama; hash asalnya dicatat. Jika belum tersedia, cabang lama dilatih ulang pada split lama dan hasil test dicatat. File v1 tidak dihapus. Flask mengutamakan `kirana_model.joblib` setelah diekspor; sebelum itu ia memakai artefak lama yang tersedia. Restart Flask setelah ekspor. Gunakan lingkungan Python yang sama untuk training dan inferensi.

## Dataset

Semua CSV revisi disertakan di `ml/dataset/`.

| File | Jumlah baris data | Kegunaan |
|---|---:|---|
| `questions.csv` | 2.000 | Bank soal yang dibaca backend dan simulasi training pilihan ganda. |
| `synthetic_profiles.csv` | 20.000 | Profil sintetis untuk simulasi dan target pola. |
| `synthetic_responses.csv` | 300.000 | Respons angka bebas dari eksperimen dataset revisi. |
| `student_features.csv` | 20.000 | Ringkasan fitur untuk eksperimen jawaban angka bebas. |

Backend dan training pilihan ganda memakai CSV ini dan logika dari `ml/simulation.py`. File tersebut menggabungkan prosedur dan mekanisme respons yang digunakan dari simulator asli. Untuk memakai CSV lain, arahkan `KIRANA_DATA_DIR` ke folder yang berisi subfolder `dataset/`.

## Evaluasi sintetis

Simulasi memakai profil dan simulator asli. Respons acak dipetakan ke tebakan pada opsi yang tampil. Jawaban kosong menjadi `skipped`, dan jawaban numerik di luar opsi menjadi `outside_options`. Mode tetap dan semi-adaptif berbagi sembilan soal inti per kelompok serta seed respons untuk pasangan siswa–soal yang sama. Pemilih soal semi-adaptif digunakan bersama dengan backend. Split siswa dan keluarga soal terpisah selama evaluasi.

| Operasi | Paket | Macro-F1 aturan | Macro-F1 logistik | Dugaan keliru logistik | Kedua pola ditemukan logistik | Sesi tanpa dugaan logistik |
|---|---|---:|---:|---:|---:|---:|
| Penjumlahan | Tetap | 0,8864 | 0,9153 | 27 | 129 dari 300 | 286 dari 1.320 |
| Penjumlahan | Semi-adaptif | 0,8823 | 0,9177 | 30 | 135 dari 300 | 281 dari 1.320 |
| Pengurangan | Tetap | 0,8644 | 0,8924 | 28 | 52 dari 299 | 331 dari 1.679 |
| Pengurangan | Semi-adaptif | 0,8483 | 0,8899 | 18 | 40 dari 299 | 342 dari 1.679 |

Hasil di atas berasal dari simulasi. Lihat [laporan evaluasi lengkap](reports/evaluation.json) untuk hasil per pola dan konfigurasi eksperimen.


## Revisi kategori adaptif v2

Notebook `notebooks/train_kirana.ipynb` menyiapkan model untuk sesi Puluhan/Ratusan/Ribuan sekaligus mempertahankan cabang sesi lama. Jangan gunakan hasil evaluasi lama untuk mengklaim kinerja kategori baru.

Jalankan dari root source code:

```powershell
.\backend\.venv\Scripts\python.exe -m jupyterlab
```

Jika Jupyter belum terpasang, jalankan `.\backend\.venv\Scripts\python.exe -m pip install jupyterlab` dari root source code. Buka notebook utama, jalankan persiapan dan audit, lalu simulasi, training, dan evaluasi secara berurutan. Simulasi menggunakan fungsi simulator asli dan pemilih backend; tidak mengubah CSV maupun jawaban siswa asli.

Dua model logistik multilabel dilatih, satu per operasi. Sampel tiga kategori digabung hanya di dalam split yang sama. Ambang ditentukan per kategori pada validation, kemudian dikunci untuk test. Evaluasi melaporkan pola yang terukur saja dan mencantumkan pola tidak terukur terpisah. Profil siswa yang muncul pada beberapa kategori tetap berada pada split asal; keluarga soal divalidasi saat membaca bank.

Periksa precision/recall, dugaan keliru, keberhasilan menemukan kedua target terukur pada MIXED, frekuensi menahan dugaan, dan false calls dugaan awal. Skor model tidak dikalibrasi sebagai kepastian siswa nyata. Syarat supported tetap dua kecocokan + satu pembeda + ambang; dugaan awal tidak disamakan dengan diagnosis tervalidasi.

`EXPORT_MODEL = False` secara bawaan. Ubah ke True setelah meninjau evaluasi, lalu jalankan sel ekspor. File baru: `ml/artifacts/kirana_model.joblib`; artefak lama tidak ditimpa. Sel ekspor memuat ulang artefak dan membandingkan skor/ambang. Restart Flask setelah ekspor. Dependensi training dan inferensi harus sama.

Alternatif CLI yang secara eksplisit melakukan training:

```powershell
.\backend\.venv\Scripts\python.exe -m ml.unified_training
# Tambahkan --export hanya jika ingin menulis artefak.
```

Laporan training baru ditulis ke `ml/reports/category_evaluation.json`. Pada implementasi revisi ini training dan ekspor TIDAK dijalankan. `category_bank_audit.json` adalah audit bank, bukan hasil akurasi. `revision_original_audit.json` adalah audit read-only tiga percobaan asli tanpa nama/token.
