import type { StatusSesi } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Status sesi Terbuka/Ditutup.
 * - gaya "lama": pill hijau/abu dengan titik atau gembok (B2 tabel, B4).
 * - gaya "baru": pill emerald/slate seperti desain baru (B1).
 * Status tidak hanya dibedakan warna: ada teks dan ikon/titik.
 */
export function StatusBadge({ status, gaya = "lama" }: { status: StatusSesi; gaya?: "lama" | "baru" }) {
  const terbuka = status === "terbuka";
  if (gaya === "baru") {
    return terbuka ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-600" />
        Terbuka
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
        <Icon nama="gembok" ukuran={12} tebal={2.5} />
        Ditutup
      </span>
    );
  }
  return terbuka ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-soft px-2.5 py-1 text-[13px] font-bold text-success">
      <span aria-hidden="true" className="size-2 rounded-full bg-success" />
      Terbuka
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-divider px-2.5 py-1 text-[13px] font-bold text-ink-2">
      <Icon nama="gembok" ukuran={13} tebal={2.5} />
      Ditutup
    </span>
  );
}
