/**
 * Kontrak data frontend Kirana (lihat PRD bagian "Data yang dibutuhkan frontend").
 * Tipe di sini yang dipakai komponen. Kunci jawaban dan pemetaan opsi ke pola
 * TIDAK ada di sini; itu urusan backend.
 */

export type NumberCategory = "tens" | "hundreds" | "thousands";
export const namaKategori = (category: NumberCategory | null) => category === "tens" ? "Puluhan" : category === "hundreds" ? "Ratusan" : category === "thousands" ? "Ribuan" : "Campuran — sesi lama";

export type Operasi = "penjumlahan" | "pengurangan";
export type StatusSesi = "terbuka" | "ditutup";

export const JUMLAH_SOAL = 15;

/** Sesi kuis seperti yang dilihat guru. */
export interface Sesi {
  numberCategory: NumberCategory | null;
  quizPolicyVersion: string;
  id: string;
  joinUrl: string;
  joinQrSvg: string;
  jumlahPeserta: number;
  kode: string; // format KRN-XXXXXX
  operasi: Operasi;
  status: StatusSesi;
  jumlahSoal: number;
  dibuatPada: string; // ISO 8601
  ditutupPada: string | null;
  jumlahPengumpulan: number;
}

/** Info sesi yang aman ditampilkan ke siswa sebelum mulai. */
export interface SesiSiswa {
  numberCategory: NumberCategory | null;
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
  soal: Soal[];
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

/* ---------- Hasil diagnosis (dari layanan diagnosis) ---------- */

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

export type StatusBukti = "dugaan_awal" | "tidak_tersedia" | "pola_didukung" | "ambigu" | "belum_cukup" | "tanpa_pola";

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
  assessments: PatternAssessment[];
  timeline: EvidencePoint[];
  ambiguousGroups: { patterns: string[]; shared_answers: number; reason: string }[];
  modelCompatibility: string;
  policyVersion: string;
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
  /** P2.2: false jika model ML tidak termuat saat hasil dihitung; status hanya dari aturan hitung. */
  modelAktif: boolean;
  /** Penilaian semua pola; dipakai rekap kelas. */
  penilaian: PatternAssessment[];
}

/** Detail diagnosis satu siswa (D2). */
export interface DetailDiagnosis {
  sesi: Sesi;
  pengumpulan: Pengumpulan;
  hasil: HasilDiagnosis;
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

export interface PatternAssessment {
  pattern: string; name: string;
  status: "supported" | "preliminary" | "ambiguous" | "insufficient_evidence" | "not_measurable" | "no_pattern_detected";
  reasons: string[]; score: number | null; threshold: number | null;
  matching_answers: number; distinguishing_answers: number; shown_opportunities: number; answered_opportunities: number;
  examples: { position: number; operand_1: number; operand_2: number; selected_value: number; correct_value: number }[];
}
export interface EvidencePoint {
  position: number; operand_1: number; operand_2: number; kind: string; selected_value: number | null; correct_value: number;
  matching_answers: Record<string, number>; distinguishing_answers: Record<string, number>; new_distinguishing: string[];
}
