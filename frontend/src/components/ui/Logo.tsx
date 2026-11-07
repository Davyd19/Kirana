import Image from "next/image";

/** Ukuran asli /public/gambar/logokirana.png (dipakai untuk menjaga proporsi). */
const LEBAR_ASLI = 472;
const TINGGI_ASLI = 506;

/**
 * Logo resmi Kirana dari /public/gambar/logokirana.png.
 * Aset berupa maskot tanpa tulisan, jadi nama produk "Kirana" ditulis di
 * sampingnya (seperti desain baru). Proporsi gambar selalu dipertahankan.
 *
 * - `tinggi`: tinggi maskot dalam px.
 * - `tanpaNama`: hanya maskot (misalnya maskot besar di kartu siswa).
 * - `dekoratif`: alt kosong jika nama sudah dibacakan elemen pembungkus.
 */
export function Logo({
  tinggi = 36,
  tanpaNama = false,
  dekoratif = false,
  prioritas = false,
  className = "",
}: {
  tinggi?: number;
  tanpaNama?: boolean;
  dekoratif?: boolean;
  prioritas?: boolean;
  className?: string;
}) {
  const lebar = Math.round((tinggi * LEBAR_ASLI) / TINGGI_ASLI);
  const gambar = (
    <Image
      src="/gambar/logokirana.png"
      alt={dekoratif || !tanpaNama ? "" : "Kirana"}
      width={lebar}
      height={tinggi}
      priority={prioritas}
      className="block h-auto max-w-full flex-none"
      style={{ width: lebar }}
    />
  );
  if (tanpaNama) return <span className={`inline-flex ${className}`}>{gambar}</span>;
  return (
    <span className={`gaya-baru inline-flex items-center gap-2 ${className}`}>
      {gambar}
      <span
        className="font-black tracking-tight text-navy"
        style={{ fontSize: Math.max(18, Math.min(24, Math.round(tinggi * 0.55))) }}
      >
        Kirana
      </span>
    </span>
  );
}
