/**
 * SIMULASI BACKEND — "server" tiruan di atas localStorage.
 *
 * Hanya src/services/kirana.ts yang boleh mengimpor file ini. Fungsi di sini
 * sinkron; latensi dan kegagalan ditambahkan oleh service.
 *
 * Kunci storage:
 *   kirana:seed-versi     versi seed yang terpasang
 *   kirana:sessions       SesiDb[]
 *   kirana:submissions    PengumpulanDb[]
 *   kirana:auth           AuthState
 *   kirana:attempt:<kode> Attempt (progres siswa di browser ini)
 *   kirana:pengaturan     Pengaturan (lihat simulasi.ts)
 */
import { baca, bacaMentah, hapus, hapusSemua, tulis } from "@/lib/storage";
import {
  JUMLAH_SOAL,
  KiranaError,
  type Attempt,
  type AuthState,
  type ContohKondisi,
  type DetailDiagnosis,
  type HasilSiswa,
  type Operasi,
  type Pengumpulan,
  type Respons,
  type Ringkasan,
  type Sesi,
  type SesiSiswa,
  type Soal,
} from "@/lib/types";
import { diagnosis } from "./diagnosis";
import { ambilPaket, paketUntukOperasi } from "./paket-soal";
import { buatSeed, CONTOH_KONDISI, GURU_DEMO, type PengumpulanDb, type SesiDb } from "./seed";

const VERSI_SEED = 1;
const K = {
  versi: "seed-versi",
  sesi: "sessions",
  pengumpulan: "submissions",
  auth: "auth",
  attempt: (kode: string) => `attempt:${kode}`,
};

/* ---------------- Seed ---------------- */

function pastikanSeed(): void {
  if (baca<number>(K.versi) === VERSI_SEED) return;
  const seed = buatSeed();
  tulis(K.sesi, seed.sesi);
  tulis(K.pengumpulan, seed.pengumpulan);
  tulis(K.versi, VERSI_SEED);
}

function semuaSesi(): SesiDb[] {
  pastikanSeed();
  return baca<SesiDb[]>(K.sesi) ?? [];
}

function semuaPengumpulan(): PengumpulanDb[] {
  pastikanSeed();
  return baca<PengumpulanDb[]>(K.pengumpulan) ?? [];
}

/** Kembalikan semua data demo ke kondisi awal. Status login dipertahankan. */
export function resetDataDemo(): void {
  const auth = baca<AuthState>(K.auth);
  hapusSemua();
  pastikanSeed();
  if (auth) tulis(K.auth, auth);
}

/* ---------------- Auth ---------------- */

export function masuk(email: string, sandi: string): AuthState {
  if (email.trim().toLowerCase() !== GURU_DEMO.email || sandi.length === 0) {
    throw new KiranaError("kredensial_salah", "Email atau kata sandi belum cocok. Periksa lagi lalu coba masuk.");
  }
  pastikanSeed();
  const auth: AuthState = { guru: GURU_DEMO, masukPada: new Date().toISOString() };
  tulis(K.auth, auth);
  return auth;
}

export function keluar(): void {
  hapus(K.auth);
}

/** String mentah agar referensinya stabil untuk useSyncExternalStore. */
export function bacaAuthMentah(): string | null {
  return bacaMentah(K.auth);
}

/* ---------------- Sesi (guru) ---------------- */

function keSesi(s: SesiDb, pengumpulan: PengumpulanDb[]): Sesi {
  return {
    id: s.id,
    kode: s.kode,
    operasi: s.operasi,
    status: s.status,
    jumlahSoal: JUMLAH_SOAL,
    dibuatPada: s.dibuatPada,
    ditutupPada: s.ditutupPada,
    jumlahPengumpulan: pengumpulan.filter((p) => p.sesiId === s.id).length,
  };
}

export function daftarSesi(): Sesi[] {
  const pengumpulan = semuaPengumpulan();
  return semuaSesi()
    .map((s) => keSesi(s, pengumpulan))
    .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));
}

export function ambilSesi(id: string): Sesi {
  const s = semuaSesi().find((x) => x.id === id);
  if (!s) throw new KiranaError("tidak_ditemukan", "Sesi tidak ditemukan.");
  return keSesi(s, semuaPengumpulan());
}

function kodeUnik(terpakai: Set<string>): string {
  for (;;) {
    const kode = `KRN-${String(1000 + Math.floor(Math.random() * 9000))}`;
    if (!terpakai.has(kode)) return kode;
  }
}

export function buatSesi(operasi: Operasi): Sesi {
  const daftar = semuaSesi();
  const kode = kodeUnik(new Set(daftar.map((s) => s.kode)));

  // Sesi baru memakai paket berikutnya untuk operasi yang sama (bergiliran).
  const paket = paketUntukOperasi(operasi);
  const terakhir = daftar
    .filter((s) => s.operasi === operasi)
    .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada))[0];
  const idx = terakhir ? paket.findIndex((p) => p.id === terakhir.paketId) : -1;
  const paketId = paket[(idx + 1) % paket.length].id;

  const baru: SesiDb = {
    id: `sesi-${kode.slice(4)}-${Date.now().toString(36)}`,
    kode,
    operasi,
    paketId,
    status: "terbuka",
    dibuatPada: new Date().toISOString(),
    ditutupPada: null,
  };
  tulis(K.sesi, [...daftar, baru]);
  return keSesi(baru, []);
}

export function tutupSesi(id: string): Sesi {
  const daftar = semuaSesi();
  const s = daftar.find((x) => x.id === id);
  if (!s) throw new KiranaError("tidak_ditemukan", "Sesi tidak ditemukan.");
  if (s.status === "terbuka") {
    s.status = "ditutup";
    s.ditutupPada = new Date().toISOString();
    tulis(K.sesi, daftar);
  }
  return keSesi(s, semuaPengumpulan());
}

/* ---------------- Ringkasan ---------------- */

function hitungRingkasan(sesi: SesiDb, respons: Respons[]): Ringkasan {
  const paket = ambilPaket(sesi.paketId);
  const r: Ringkasan = { benar: 0, salah: 0, diLuarOpsi: 0, dilewati: 0 };
  for (const soal of paket.soal) {
    const x = respons.find((y) => y.soalId === soal.id);
    if (!x || x.jenis === "dilewati") r.dilewati++;
    else if (x.jenis === "di_luar_opsi") r.diLuarOpsi++;
    else if (x.opsiId === soal.kunciOpsiId) r.benar++;
    else r.salah++;
  }
  return r;
}

export function daftarPengumpulan(sesiId: string): Pengumpulan[] {
  const sesi = semuaSesi().find((x) => x.id === sesiId);
  if (!sesi) throw new KiranaError("tidak_ditemukan", "Sesi tidak ditemukan.");
  return semuaPengumpulan()
    .filter((p) => p.sesiId === sesiId)
    .sort((a, b) => b.dikumpulkanPada.localeCompare(a.dikumpulkanPada))
    .map((p) => ({
      pesertaId: p.pesertaId,
      sesiId: p.sesiId,
      nama: p.nama,
      dikumpulkanPada: p.dikumpulkanPada,
      ringkasan: hitungRingkasan(sesi, p.respons),
    }));
}

/* ---------------- Hasil & diagnosis (guru) ---------------- */

/** Baris tabel D1: pengumpulan + label diagnosis singkat, terbaru di atas. */
export function daftarHasil(sesiId: string): HasilSiswa[] {
  const sesi = semuaSesi().find((x) => x.id === sesiId);
  if (!sesi) throw new KiranaError("tidak_ditemukan", "Sesi tidak ditemukan.");
  const paket = ambilPaket(sesi.paketId);
  return semuaPengumpulan()
    .filter((p) => p.sesiId === sesiId)
    .sort((a, b) => b.dikumpulkanPada.localeCompare(a.dikumpulkanPada))
    .map((p) => {
      const h = diagnosis(paket, p.respons);
      return {
        pesertaId: p.pesertaId,
        sesiId: p.sesiId,
        nama: p.nama,
        dikumpulkanPada: p.dikumpulkanPada,
        ringkasan: h.ringkasan,
        status: h.status,
        jumlahPola: h.pola.length,
      };
    });
}

export function ambilDiagnosis(sesiId: string, pesertaId: string): DetailDiagnosis {
  const sesiDb = semuaSesi().find((x) => x.id === sesiId);
  const p = semuaPengumpulan().find((x) => x.sesiId === sesiId && x.pesertaId === pesertaId);
  if (!sesiDb || !p) throw new KiranaError("tidak_ditemukan", "Data siswa tidak ditemukan.");
  const hasil = diagnosis(ambilPaket(sesiDb.paketId), p.respons);
  return {
    sesi: keSesi(sesiDb, semuaPengumpulan()),
    pengumpulan: {
      pesertaId: p.pesertaId,
      sesiId: p.sesiId,
      nama: p.nama,
      dikumpulkanPada: p.dikumpulkanPada,
      ringkasan: hasil.ringkasan,
    },
    hasil,
  };
}

/** Pintasan demo ke lima kondisi diagnosis (hanya yang masih ada di store). */
export function daftarContohKondisi(): ContohKondisi[] {
  const ada = semuaPengumpulan();
  return CONTOH_KONDISI.filter((c) => ada.some((p) => p.pesertaId === c.pesertaId && p.sesiId === c.sesiId));
}

/* ---------------- Siswa ---------------- */

function sesiDenganKode(kode: string): SesiDb {
  const s = semuaSesi().find((x) => x.kode === kode);
  if (!s) throw new KiranaError("kode_tidak_ditemukan", "Kode kuis tidak ditemukan. Periksa kembali kode yang dimasukkan.");
  return s;
}

export function ambilSesiDenganKode(kode: string): SesiSiswa {
  const s = sesiDenganKode(kode);
  return { kode: s.kode, operasi: s.operasi, status: s.status, jumlahSoal: JUMLAH_SOAL };
}

/** Soal paket sesi, tanpa kunci jawaban dan tanpa pemetaan pola. */
export function ambilSoal(kode: string): Soal[] {
  const s = sesiDenganKode(kode);
  const paket = ambilPaket(s.paketId);
  return paket.soal.map((x) => ({
    id: x.id,
    urutan: x.urutan,
    operandAtas: x.operandAtas,
    operandBawah: x.operandBawah,
    tanda: paket.operasi === "penjumlahan" ? "+" : "−",
    opsi: x.opsi.map((o) => ({ ...o })),
  }));
}

export function ambilAttempt(kode: string): Attempt | null {
  return baca<Attempt>(K.attempt(kode));
}

export function daftarkanPeserta(kode: string, nama: string): Attempt {
  const s = sesiDenganKode(kode);
  if (s.status !== "terbuka") {
    throw new KiranaError("sesi_ditutup", "Sesi kuis ini sudah ditutup oleh guru.");
  }
  const attempt: Attempt = {
    pesertaId: `peserta-${kode.slice(4)}-${Date.now().toString(36)}`,
    nama: nama.trim(),
    respons: [],
    urutanTerakhir: 1,
    dikumpulkanPada: null,
  };
  tulis(K.attempt(kode), attempt);
  return attempt;
}

/** Hapus progres di browser ini supaya siswa lain bisa mulai. */
export function lepasAttempt(kode: string): void {
  hapus(K.attempt(kode));
}

export function simpanRespons(kode: string, respons: Respons, urutanTerakhir: number): Attempt {
  const a = ambilAttempt(kode);
  if (!a) throw new KiranaError("belum_terdaftar", "Isi nama terlebih dahulu.");
  const baru: Attempt = {
    ...a,
    respons: [...a.respons.filter((r) => r.soalId !== respons.soalId), respons],
    urutanTerakhir,
  };
  tulis(K.attempt(kode), baru);
  return baru;
}

export function simpanUrutan(kode: string, urutanTerakhir: number): Attempt {
  const a = ambilAttempt(kode);
  if (!a) throw new KiranaError("belum_terdaftar", "Isi nama terlebih dahulu.");
  const baru = { ...a, urutanTerakhir };
  tulis(K.attempt(kode), baru);
  return baru;
}

export function kumpulkan(kode: string): Pengumpulan {
  const s = sesiDenganKode(kode);
  if (s.status !== "terbuka") {
    throw new KiranaError("sesi_ditutup", "Sesi kuis ini sudah ditutup oleh guru.");
  }
  const a = ambilAttempt(kode);
  if (!a) throw new KiranaError("belum_terdaftar", "Isi nama terlebih dahulu.");

  // Soal tanpa respons dicatat sebagai dilewati.
  const paket = ambilPaket(s.paketId);
  const respons: Respons[] = paket.soal.map(
    (soal) => a.respons.find((r) => r.soalId === soal.id) ?? { jenis: "dilewati", soalId: soal.id },
  );

  const waktu = new Date().toISOString();
  const daftar = semuaPengumpulan().filter((p) => p.pesertaId !== a.pesertaId);
  const baru: PengumpulanDb = { pesertaId: a.pesertaId, sesiId: s.id, nama: a.nama, dikumpulkanPada: waktu, respons };
  tulis(K.pengumpulan, [...daftar, baru]);
  tulis(K.attempt(kode), { ...a, respons, dikumpulkanPada: waktu });

  return { pesertaId: a.pesertaId, sesiId: s.id, nama: a.nama, dikumpulkanPada: waktu, ringkasan: hitungRingkasan(s, respons) };
}
