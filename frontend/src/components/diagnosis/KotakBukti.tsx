/**
 * Deretan kotak: terisi = jawaban pendukung, kosong = kesempatan lain.
 * `gaya="baru"` memakai warna navy dari palet desain baru.
 */
export function KotakBukti({
  pendukung,
  kesempatan,
  ukuran = 14,
  gaya = "lama",
}: {
  pendukung: number;
  kesempatan: number;
  ukuran?: number;
  gaya?: "lama" | "baru";
}) {
  const isi = gaya === "baru" ? "bg-navy" : "bg-primary-ink";
  const kosong = gaya === "baru" ? "border-slate-300" : "border-kotak-kosong";
  return (
    <span className="flex flex-wrap gap-1" aria-hidden="true">
      {Array.from({ length: kesempatan }, (_, i) => (
        <span
          key={i}
          style={{ width: ukuran, height: ukuran }}
          className={i < pendukung ? `rounded-[4px] ${isi}` : `box-border rounded-[4px] border-2 ${kosong}`}
        />
      ))}
    </span>
  );
}
