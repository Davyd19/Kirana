/**
 * SIMULASI BACKEND — latensi dan kegagalan tiruan.
 *
 * Kegagalan bisa dipicu dua cara (keduanya hanya berlaku SEKALI, lalu mati
 * sendiri supaya alur "coba lagi lalu berhasil" mudah didemokan):
 * 1. Query `?simulasi=gagal` di URL halaman. Berlaku sekali per muat halaman.
 * 2. Flag `kirana:pengaturan` = {"simulasiGagal": true} di localStorage
 *    (halaman Pengaturan sudah dihapus; flag ini tetap bisa diisi lewat DevTools).
 */
import { baca, tulis } from "@/lib/storage";

export interface Pengaturan {
  simulasiGagal: boolean;
}

const KUNCI_PENGATURAN = "pengaturan";

export function bacaPengaturan(): Pengaturan {
  return baca<Pengaturan>(KUNCI_PENGATURAN) ?? { simulasiGagal: false };
}

export function simpanPengaturan(p: Pengaturan): void {
  tulis(KUNCI_PENGATURAN, p);
}

export function tunda(): Promise<void> {
  const ms = 300 + Math.floor(Math.random() * 500);
  return new Promise((r) => setTimeout(r, ms));
}

let queryTerpakai = false;

/** True jika operasi ini harus gagal. Memakai "jatah" kegagalan yang tersedia. */
export function harusGagal(): boolean {
  const p = bacaPengaturan();
  if (p.simulasiGagal) {
    simpanPengaturan({ ...p, simulasiGagal: false });
    return true;
  }
  if (!queryTerpakai && typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("simulasi");
    if (q === "gagal") {
      queryTerpakai = true;
      return true;
    }
  }
  return false;
}
