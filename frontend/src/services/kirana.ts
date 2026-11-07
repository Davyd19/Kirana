/**
 * Lapisan service Kirana — SATU-SATUNYA pintu data untuk komponen.
 *
 * Saat ini implementasinya memanggil "server" tiruan di src/mocks/ dengan
 * latensi 300–800 ms dan kegagalan simulasi. Ketika backend siap, cukup isi
 * fungsi-fungsi di file ini dengan pemanggilan API; komponen tidak berubah.
 *
 * Fungsi yang menandai `bisaGagal` dapat gagal dengan KiranaError("jaringan")
 * jika simulasi gangguan aktif (tambahkan `?simulasi=gagal` di URL halaman).
 */
import * as server from "@/mocks/server";
import { harusGagal, tunda } from "@/mocks/simulasi";
import {
  KiranaError,
  type Attempt,
  type AuthState,
  type ContohKondisi,
  type DetailDiagnosis,
  type HasilSiswa,
  type Operasi,
  type Pengumpulan,
  type Respons,
  type Sesi,
  type SesiSiswa,
  type Soal,
} from "@/lib/types";

async function jalankan<T>(fn: () => T, opsi: { bisaGagal?: boolean; pesanGagal?: string } = {}): Promise<T> {
  await tunda();
  if (opsi.bisaGagal && harusGagal()) {
    throw new KiranaError("jaringan", opsi.pesanGagal ?? "Koneksi sedang terganggu. Silakan coba lagi.");
  }
  return fn();
}

/* ---------------- Auth guru (login demo lokal) ---------------- */

export function masuk(email: string, sandi: string): Promise<AuthState> {
  return jalankan(() => server.masuk(email, sandi), {
    bisaGagal: true,
    pesanGagal: "Belum bisa masuk karena koneksi terganggu. Silakan coba lagi.",
  });
}

export async function keluar(): Promise<void> {
  server.keluar();
}

/** Baca status login secara sinkron (untuk useSyncExternalStore). */
export function bacaAuthMentah(): string | null {
  return server.bacaAuthMentah();
}

/* ---------------- Sesi (guru) ---------------- */

export function buatSesi(operasi: Operasi): Promise<Sesi> {
  return jalankan(() => server.buatSesi(operasi), {
    bisaGagal: true,
    pesanGagal: "Sesi belum berhasil dibuat. Silakan coba lagi.",
  });
}

export function daftarSesi(): Promise<Sesi[]> {
  return jalankan(() => server.daftarSesi());
}

export function ambilSesi(sesiId: string): Promise<Sesi> {
  return jalankan(() => server.ambilSesi(sesiId));
}

export function tutupSesi(sesiId: string): Promise<Sesi> {
  return jalankan(() => server.tutupSesi(sesiId));
}

export function daftarPengumpulan(sesiId: string): Promise<Pengumpulan[]> {
  return jalankan(() => server.daftarPengumpulan(sesiId));
}

/* ---------------- Hasil & diagnosis (guru) ---------------- */

/** Pengumpulan sesi beserta label diagnosis singkat (D1). */
export function daftarHasil(sesiId: string): Promise<HasilSiswa[]> {
  return jalankan(() => server.daftarHasil(sesiId));
}

/** Hasil diagnosis satu siswa (D2). Urutan pola mengikuti layanan diagnosis. */
export function getDiagnosis(sesiId: string, pesertaId: string): Promise<DetailDiagnosis> {
  return jalankan(() => server.ambilDiagnosis(sesiId, pesertaId));
}

/** Mode demo: siswa contoh untuk lima kondisi diagnosis. */
export async function daftarContohKondisi(): Promise<ContohKondisi[]> {
  return server.daftarContohKondisi();
}

/* ---------------- Siswa (tamu) ---------------- */

export function ambilSesiDenganKode(kode: string): Promise<SesiSiswa> {
  return jalankan(() => server.ambilSesiDenganKode(kode), {
    bisaGagal: true,
    pesanGagal: "Koneksi sedang terganggu. Periksa internet lalu coba lagi.",
  });
}

/**
 * Info sesi untuk memuat halaman kuis (/kuis/[kode]/*). Tidak ikut simulasi
 * gangguan, supaya `?simulasi=gagal` di halaman konfirmasi mengenai aksi
 * "Kumpulkan", bukan pemuatan halaman.
 */
export function ambilInfoSesi(kode: string): Promise<SesiSiswa> {
  return jalankan(() => server.ambilSesiDenganKode(kode));
}

export function ambilSoal(kode: string): Promise<Soal[]> {
  return jalankan(() => server.ambilSoal(kode));
}

export function daftarkanPeserta(kode: string, nama: string): Promise<Attempt> {
  return jalankan(() => server.daftarkanPeserta(kode, nama));
}

/** Progres pengerjaan di browser ini. Dibaca langsung tanpa latensi. */
export async function ambilAttempt(kode: string): Promise<Attempt | null> {
  return server.ambilAttempt(kode);
}

export async function lepasAttempt(kode: string): Promise<void> {
  server.lepasAttempt(kode);
}

/** Respons disimpan seketika agar tidak hilang saat halaman dimuat ulang. */
export async function simpanRespons(kode: string, respons: Respons, urutanTerakhir: number): Promise<Attempt> {
  return server.simpanRespons(kode, respons, urutanTerakhir);
}

export async function simpanUrutan(kode: string, urutanTerakhir: number): Promise<Attempt> {
  return server.simpanUrutan(kode, urutanTerakhir);
}

export function kumpulkan(kode: string): Promise<Pengumpulan> {
  return jalankan(() => server.kumpulkan(kode), {
    bisaGagal: true,
    pesanGagal: "Jawaban belum berhasil dikumpulkan. Pilihanmu tetap tersimpan, silakan coba lagi.",
  });
}

/* ---------------- Mode demo ---------------- */

export async function resetDataDemo(): Promise<void> {
  await tunda();
  server.resetDataDemo();
}
