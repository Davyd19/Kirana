/**
 * Kontrak data frontend Kirana (lihat PRD bagian "Data yang dibutuhkan frontend").
 * Tipe di sini yang dipakai komponen. Kunci jawaban dan pemetaan opsi ke pola
 * TIDAK ada di sini; itu urusan backend (sementara: src/mocks/).
 */

export type Operasi = "penjumlahan" | "pengurangan";
export type StatusSesi = "terbuka" | "ditutup";

export const JUMLAH_SOAL = 15;

/** Sesi kuis seperti yang dilihat guru. */
export interface Sesi {
  id: string;
  kode: string; // format KRN-####
  operasi: Operasi;
  status: StatusSesi;
  jumlahSoal: number;
  dibuatPada: string; // ISO 8601
  ditutupPada: string | null;
  jumlahPengumpulan: number;
}

/** Info sesi yang aman ditampilkan ke siswa sebelum mulai. */
export interface SesiSiswa {
  kode: string;
  operasi: Operasi;
  status: StatusSesi;
  jumlahSoal: number;
}

export interface Opsi {
  id: string;
  nilai: number;
}

/** Soal yang dikirim ke siswa: tanpa kunci jawaban. */
export interface Soal {
  id: string;
  urutan: number; // 1..15
  operandAtas: number;
  operandBawah: number;
  tanda: "+" | "−";
  opsi: Opsi[]; // selalu 4, posisi tetap
}

/**
 * Respons siswa per soal. Tiga jenis yang selalu dibedakan.
 * Opsi bernilai 0 adalah jenis "opsi" biasa.
 * Soal yang belum dijawab TIDAK punya entri respons sama sekali.
 */
export type Respons =
  | { jenis: "opsi"; soalId: string; opsiId: string }
  | { jenis: "di_luar_opsi"; soalId: string }
  | { jenis: "dilewati"; soalId: string };

/** Progres pengerjaan siswa di browser ini (kirana:attempt:<kode>). */
export interface Attempt {
  pesertaId: string;
  nama: string;
  respons: Respons[];
  urutanTerakhir: number;
  dikumpulkanPada: string | null;
}

/** Ringkasan 4 kategori. benar + salah + diLuarOpsi + dilewati = jumlah soal. */
export interface Ringkasan {
  benar: number;
  salah: number;
  diLuarOpsi: number;
  dilewati: number;
}

/** Pengumpulan seperti yang dilihat guru. */
export interface Pengumpulan {
  pesertaId: string;
  sesiId: string;
  nama: string;
  dikumpulkanPada: string;
  ringkasan: Ringkasan;
}

export interface Guru {
  nama: string;
  email: string;
}

export interface AuthState {
  guru: Guru;
  masukPada: string;
}

/* ---------- Hasil diagnosis (dari layanan diagnosis; sementara src/mocks/diagnosis.ts) ---------- */

export interface ContohBukti {
  soalId: string;
  urutan: number;
  operandAtas: number;
  operandBawah: number;
  tanda: "+" | "−";
  pilihanSiswa: number;
  jawabanBenar: number;
}

export interface PolaDidukung {
  id: string;
  nama: string; // nama yang mudah dipahami guru
  jumlahPendukung: number;
  jumlahKesempatan: number;
  contoh: ContohBukti[];
  saran: string;
}

export interface KelompokAmbigu {
  pola: { id: string; nama: string }[];
  judul: string;
  keterangan: string;
  contoh: ContohBukti[];
  /** Saran soal pembeda yang bisa dikerjakan bersama siswa. */
  saranPembeda: string;
}

export type StatusBukti = "pola_didukung" | "ambigu" | "belum_cukup" | "tanpa_pola";

export type JenisRincian = "benar" | "salah" | "di_luar_opsi" | "dilewati";

/** Satu baris di grid "Rincian 15 jawaban". */
export interface RincianJawaban {
  urutan: number;
  operandAtas: number;
  operandBawah: number;
  tanda: "+" | "−";
  jenis: JenisRincian;
  pilihanSiswa: number | null;
  jawabanBenar: number;
}

export interface HasilDiagnosis {
  status: StatusBukti;
  ringkasan: Ringkasan;
  pola: PolaDidukung[]; // urutan dari layanan diagnosis
  ambigu: KelompokAmbigu[];
  /** Diisi jika status "belum_cukup". */
  alasanBelumCukup: string | null;
  saranBelumCukup: string | null;
  /** Diisi jika status "tanpa_pola": penjelasan cakupan pengamatan. */
  keteranganTanpaPola: string | null;
  rincian: RincianJawaban[];
}

/** Baris tabel hasil (D1): pengumpulan + label diagnosis singkat. */
export interface HasilSiswa extends Pengumpulan {
  status: StatusBukti;
  jumlahPola: number;
}

/** Detail diagnosis satu siswa (D2). */
export interface DetailDiagnosis {
  sesi: Sesi;
  pengumpulan: Pengumpulan;
  hasil: HasilDiagnosis;
}

/** Pintasan mode demo ke siswa contoh untuk tiap kondisi diagnosis. */
export interface ContohKondisi {
  label: string;
  sesiId: string;
  pesertaId: string;
}

/** Kesalahan yang ditampilkan ke pengguna. */
export class KiranaError extends Error {
  constructor(
    public readonly kodeError:
      | "jaringan"
      | "kode_tidak_ditemukan"
      | "sesi_ditutup"
      | "kredensial_salah"
      | "tidak_ditemukan"
      | "belum_terdaftar",
    pesan: string,
  ) {
    super(pesan);
    this.name = "KiranaError";
  }
}
