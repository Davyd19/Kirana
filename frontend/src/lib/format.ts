import type { Operasi } from "./types";

const ZONA = "Asia/Jakarta";

/** "09.14" */
export function formatJam(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONA,
  })
    .format(new Date(iso))
    .replace(":", ".");
}

/** "7 Nov 2026" */
export function formatTanggal(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONA,
  })
    .format(new Date(iso))
    .replace(".", "");
}

/** "7 Nov 2026, 08.52" */
export function formatTanggalJam(iso: string): string {
  return `${formatTanggal(iso)}, ${formatJam(iso)}`;
}

export function namaOperasi(op: Operasi): string {
  return op === "penjumlahan" ? "Penjumlahan" : "Pengurangan";
}

export function namaOperasiBersusun(op: Operasi): string {
  return `${namaOperasi(op)} Bersusun`;
}

export function tandaOperasi(op: Operasi): "+" | "−" {
  return op === "penjumlahan" ? "+" : "−";
}
