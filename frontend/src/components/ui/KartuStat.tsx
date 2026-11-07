export function KartuStat({ label, nilai, keterangan, aksen }: { label: string; nilai: number; keterangan: string; aksen: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl border border-t-4 border-slate-200 bg-white p-4 shadow-xs ${aksen}`}>
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className="m-0 text-3xl font-black text-navy">{nilai}</dd>
      <dd className="m-0 text-[11px] leading-snug text-slate-500">{keterangan}</dd>
    </div>
  );
}

