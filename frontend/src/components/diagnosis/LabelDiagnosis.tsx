import { Icon } from "@/components/ui/Icon";
import type { StatusBukti } from "@/lib/types";

/** Teks label singkat sesuai status dari layanan diagnosis. */
export function teksLabelDiagnosis(status: StatusBukti, jumlahPola: number): string {
  switch (status) {
    case "dugaan_awal":
      return "Dugaan awal";
    case "pola_didukung":
      return `${jumlahPola} pola didukung`;
    case "ambigu":
      return "Kemungkinan ambigu";
    case "tidak_tersedia":
      return "Diagnosis belum tersedia";
    case "belum_cukup":
      return "Bukti belum cukup";
    case "tanpa_pola":
      return "Belum ada pola";
  }
}

/**
 * Label diagnosis gaya lama (D1). Tiap status punya bentuk penanda berbeda
 * (kotak, lingkaran, garis putus, centang) agar tidak bergantung pada warna.
 */
export function LabelDiagnosis({ status, jumlahPola }: { status: StatusBukti; jumlahPola: number }) {
  const teks = teksLabelDiagnosis(status, jumlahPola);
  const dasar = "inline-flex items-center gap-2 whitespace-nowrap rounded-badge px-3 py-1.5 text-sm font-bold";
  switch (status) {
    case "pola_didukung":
      return (
        <span className={`${dasar} bg-primary-soft text-primary-ink`}>
          <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-primary-ink" />
          {teks}
        </span>
      );
    case "ambigu":
      return (
        <span className={`${dasar} bg-luar-soft text-luar-ink`}>
          <span aria-hidden="true" className="box-border size-2.5 rounded-full border-2 border-luar-ink" />
          {teks}
        </span>
      );
    case "tidak_tersedia":
    case "dugaan_awal":
    case "belum_cukup":
      return (
        <span className={`${dasar} bg-divider text-ink-2`}>
          <span aria-hidden="true" className="h-0 w-2.5 border-t-2 border-dashed border-ink-2" />
          {teks}
        </span>
      );
    case "tanpa_pola":
      return (
        <span className={`${dasar} bg-success-soft text-success`}>
          <Icon nama="centang" ukuran={14} tebal={3} />
          {teks}
        </span>
      );
  }
}
