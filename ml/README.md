# Machine learning Kirana

Folder ini berisi simulasi pilihan ganda, training, dan prediksi. [Backend](../backend/README.md) tetap mengelola sesi kuis, menyimpan respons, dan memanggil prediksi untuk laporan guru. Training berjalan sebagai tugas terpisah. Saat melayani kuis, Flask memuat model langsung dari file.

| Lokasi | Isi |
|---|---|
| `notebooks/train_kirana_mcq.ipynb` | Alur interaktif simulasi, training, dan evaluasi. |
| `train.py` dan `training.py` | Perintah dan fungsi training dari terminal. |
| `diagnosis.py` | Pemuatan model dan prediksi pola. |
| `simulation.py` | Prosedur penjumlahan dan pengurangan serta simulasi respons. |
| `dataset/` | Empat CSV dataset sintetis Kirana. |
| `reports/evaluation.json` | Metrik validation dan test, seed, versi paket, dan hash sumber. |
| `artifacts/kirana_mcq_v1.joblib` | Model lokal yang digunakan Flask. |

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

Buka [notebook pilihan ganda](notebooks/train_kirana_mcq.ipynb). Jalankan dua bagian pertama untuk membaca laporan yang sudah tersedia. Untuk melatih ulang, jalankan sel simulasi, training, dan test. Ubah `EXPORT_MODEL` menjadi `True` untuk menulis artefak dari notebook.

Setelah mengekspor model baru, mulai ulang Flask agar memuatnya. Gunakan artefak tepercaya hasil training sendiri. `KIRANA_MODEL_PATH` dapat mengarahkan Flask ke artefak lain yang kompatibel. Ketika model belum tersedia, API tetap menghitung skor dan mengembalikan diagnosis `unavailable`.

## Dataset

Semua CSV revisi disertakan di `ml/dataset/`.

| File | Jumlah baris data | Kegunaan |
|---|---:|---|
| `questions.csv` | 2.000 | Bank soal yang dibaca backend dan simulasi training pilihan ganda. |
| `synthetic_profiles.csv` | 20.000 | Profil sintetis untuk simulasi dan target pola. |
| `synthetic_responses.csv` | 300.000 | Respons angka bebas dari eksperimen dataset revisi. |
| `student_features.csv` | 20.000 | Ringkasan fitur untuk eksperimen jawaban angka bebas. |

Backend dan training pilihan ganda memakai CSV ini dan logika dari `ml/simulation.py`. File tersebut menggabungkan prosedur dan mekanisme respons yang digunakan dari simulator asli. Untuk memakai CSV lain, arahkan `KIRANA_DATA_DIR` atau `--data-dir` ke folder yang berisi subfolder `dataset/`.

## Evaluasi sintetis

Simulasi memakai profil dan simulator asli. Respons acak dipetakan ke tebakan pada opsi yang tampil. Jawaban kosong menjadi `skipped`, dan jawaban numerik di luar opsi menjadi `outside_options`. Mode tetap dan semi-adaptif berbagi sembilan soal inti per kelompok serta seed respons untuk pasangan siswa–soal yang sama. Pemilih soal semi-adaptif digunakan bersama dengan backend. Split siswa dan keluarga soal terpisah selama evaluasi.

| Operasi | Paket | Macro-F1 aturan | Macro-F1 logistik | Dugaan keliru logistik | Kedua pola ditemukan logistik | Sesi tanpa dugaan logistik |
|---|---|---:|---:|---:|---:|---:|
| Penjumlahan | Tetap | 0,8864 | 0,9153 | 27 | 129 dari 300 | 286 dari 1.320 |
| Penjumlahan | Semi-adaptif | 0,8823 | 0,9177 | 30 | 135 dari 300 | 281 dari 1.320 |
| Pengurangan | Tetap | 0,8644 | 0,8924 | 28 | 52 dari 299 | 331 dari 1.679 |
| Pengurangan | Semi-adaptif | 0,8483 | 0,8899 | 18 | 40 dari 299 | 342 dari 1.679 |

Hasil di atas berasal dari simulasi. Lihat [laporan evaluasi lengkap](reports/evaluation.json) untuk hasil per pola dan konfigurasi eksperimen.
