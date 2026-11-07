"use client";
import { useState } from "react";
import type { HasilDiagnosis, PatternAssessment } from "@/lib/types";
const labels: Record<PatternAssessment["status"], string> = { supported: "Pola didukung", preliminary: "Dugaan awal", ambiguous: "Belum dapat dibedakan", insufficient_evidence: "Bukti belum cukup", not_measurable: "Tidak terukur pada kategori ini", no_pattern_detected: "Tidak ada pola terdeteksi" };
const colors = ["#2563eb", "#0f766e", "#a16207", "#9333ea", "#be123c", "#475569"];
const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs";
export function GrafikBukti({ hasil, tanda }: { hasil: HasilDiagnosis; tanda: string }) {
  const all = hasil.assessments;
  const measured = all.filter(p => p.status !== "not_measurable");
  const model = measured.some(p => p.score !== null);
  const ranked = [...measured].sort((a,b) => (model ? (b.score ?? -1)-(a.score ?? -1) : b.matching_answers-a.matching_answers) || a.pattern.localeCompare(b.pattern));
  const [hidden, setHidden] = useState<string[]>([]);
  const [position, setPosition] = useState(15);
  const point = hasil.timeline.find(t => t.position === position);
  const max = Math.max(1, ...measured.map(p => p.matching_answers));
  const x = (n: number) => 48 + (n-1)*42;
  const y = (n: number) => 230 - n / max * 190;
  return <>
    <section className={card} aria-labelledby="peringkat-pola">
      <h2 id="peringkat-pola" className="text-lg font-extrabold">{model ? "Peringkat skor model" : "Jumlah kecocokan jawaban"}</h2>
      <p className="text-sm text-slate-500">{model ? "Skor model bukan persentase kepastian. Bukti dan ambang tetap menentukan status." : "Model kategori belum tersedia. Grafik ini menunjukkan bukti aturan, bukan skor model."}</p>
      <ol className="flex list-none flex-col gap-4 p-0">{ranked.map(p => <li key={p.pattern}>
        <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm"><span><strong>{p.pattern}</strong> · {p.name}</span><strong>{model ? p.score?.toFixed(3) ?? "—" : `${p.matching_answers} kecocokan`}</strong></div>
        <div className="relative h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-turquoise" style={{ width: `${100*(model ? p.score ?? 0 : p.matching_answers/max)}%` }} />{model && p.threshold !== null && p.threshold <= 1 && <span title={`Ambang ${p.threshold.toFixed(3)}`} className="absolute top-[-3px] h-5 border-l-2 border-navy" style={{ left: `${p.threshold*100}%` }} />}</div>
        <p className="mt-1 text-xs text-slate-600">{labels[p.status]} · {p.matching_answers} cocok · {p.distinguishing_answers} pembeda · {p.answered_opportunities}/{p.shown_opportunities} kesempatan dijawab{model && p.threshold !== null ? ` · Ambang ${p.threshold > 1 ? "menahan semua dugaan" : p.threshold.toFixed(3)}` : ""}</p>
      </li>)}</ol>
      {all.filter(p => p.status === "not_measurable").map(p => <p key={p.pattern} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{p.pattern} · {p.name}</strong> — Tidak terukur pada kategori ini.</p>)}
      <details><summary className="cursor-pointer py-2 text-sm font-bold">Tabel angka dan alasan setiap pola</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Penilaian semua pola</caption><thead><tr>{["Pola","Status","Skor / ambang","Cocok","Pembeda","Dijawab / ditampilkan","Alasan"].map(v => <th key={v} className="border-b border-slate-200 p-2">{v}</th>)}</tr></thead><tbody>{all.map(p => <tr key={p.pattern}><th className="p-2">{p.pattern}</th><td className="p-2">{labels[p.status]}</td><td className="p-2">{p.score?.toFixed(3) ?? "—"} / {p.threshold?.toFixed(3) ?? "—"}</td><td className="p-2">{p.matching_answers}</td><td className="p-2">{p.distinguishing_answers}</td><td className="p-2">{p.answered_opportunities} / {p.shown_opportunities}</td><td className="min-w-56 p-2">{p.reasons.join(" ")}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className={card} aria-labelledby="perkembangan-bukti">
      <h2 id="perkembangan-bukti" className="text-lg font-extrabold">Perkembangan bukti soal 1–15</h2><p className="text-sm text-slate-500">Jumlah kecocokan kumulatif, bukan probabilitas diagnosis. Satu jawaban dapat mendukung beberapa kandidat. Titik berbingkai tebal menandai bukti pembeda baru.</p>
      <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-bold">Pola yang ditampilkan</legend>{measured.map(p => <label key={p.pattern} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={!hidden.includes(p.pattern)} onChange={() => setHidden(h => h.includes(p.pattern) ? h.filter(v => v !== p.pattern) : [...h,p.pattern])} /><span style={{ color: colors[all.indexOf(p)] }}>{p.pattern}</span></label>)}</fieldset>
      <p className="text-xs text-slate-500 sm:hidden">Geser grafik ke samping untuk melihat seluruh 15 soal, atau gunakan pilihan nomor soal di bawah.</p>
      <div className="overflow-x-auto"><svg viewBox="0 0 680 280" className="w-full min-w-[580px]" role="img" aria-label="Grafik kecocokan kumulatif menurut urutan soal">
        {[0,Math.ceil(max/2),max].filter((v,i,a) => a.indexOf(v)===i).map(n => <g key={n}><line x1="48" x2="636" y1={y(n)} y2={y(n)} stroke="#e2e8f0"/><text x="30" y={y(n)+4} fontSize="12" textAnchor="end">{n}</text></g>)}
        {hasil.timeline.map(t => <text key={t.position} x={x(t.position)} y="250" textAnchor="middle" fontSize="11">{t.position}</text>)}
        <text x="340" y="273" textAnchor="middle" fontSize="12">Urutan soal</text><text x="48" y="18" fontSize="12">Kecocokan</text>
        {measured.filter(p=>!hidden.includes(p.pattern)).map(p => <g key={p.pattern}><polyline fill="none" stroke={colors[all.indexOf(p)]} strokeWidth="2" strokeDasharray={all.indexOf(p)%2 ? "5 3" : undefined} points={hasil.timeline.map(t => `${x(t.position)},${y(t.matching_answers[p.pattern])}`).join(" ")} />{hasil.timeline.map(t => <circle key={t.position} cx={x(t.position)} cy={y(t.matching_answers[p.pattern])} r="5" fill="white" stroke={colors[all.indexOf(p)]} strokeWidth={t.new_distinguishing.includes(p.pattern)?4:2} tabIndex={0} role="button" aria-label={`Soal ${t.position}, ${p.pattern}, ${t.matching_answers[p.pattern]} kecocokan`} onClick={() => setPosition(t.position)} onKeyDown={e => { if(e.key === "Enter" || e.key === " "){e.preventDefault();setPosition(t.position);}}}><title>{p.pattern}: {t.matching_answers[p.pattern]} kecocokan; {t.distinguishing_answers[p.pattern]} pembeda</title></circle>)}</g>)}
      </svg></div>
      <label className="text-sm font-bold">Lihat respons soal <select className="ml-2 rounded-lg border border-slate-200 p-2" value={position} onChange={e => setPosition(Number(e.target.value))}>{hasil.timeline.map(t => <option key={t.position} value={t.position}>{t.position}</option>)}</select></label>
      {point && <div aria-live="polite" className="rounded-xl bg-slate-50 p-4 text-sm"><strong>Soal {position}: {point.operand_1} {tanda} {point.operand_2}</strong><p>Pilihan: {point.kind === "selected" ? point.selected_value : point.kind === "skipped" ? "Dilewati" : "Hasil di luar opsi"} · Jawaban benar: {point.correct_value}</p><p>Pembeda baru: {point.new_distinguishing.join(", ") || "Tidak ada"}</p></div>}
      <details><summary className="cursor-pointer py-2 text-sm font-bold">Tabel perkembangan bukti</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Soal</th>{measured.map(p=><th className="p-2" key={p.pattern}>{p.pattern} cocok / pembeda</th>)}</tr></thead><tbody>{hasil.timeline.map(t=><tr key={t.position}><th className="p-2">{t.position}</th>{measured.map(p=><td className="p-2" key={p.pattern}>{t.matching_answers[p.pattern]} / {t.distinguishing_answers[p.pattern]}</td>)}</tr>)}</tbody></table></div></details>
    </section>
  </>;
}
export function PenilaianPola({ hasil, tanda }: { hasil: HasilDiagnosis; tanda: string }) {
  const candidates = hasil.assessments.filter(p => ["supported","preliminary","ambiguous"].includes(p.status));
  return <>
    {hasil.modelCompatibility !== "compatible" && <p className="rounded-xl bg-slate-50 p-4 text-sm">{hasil.alasanBelumCukup}</p>}
    {!candidates.length && <p className="rounded-xl bg-slate-50 p-4">{hasil.assessments.some(p=>p.status==="insufficient_evidence") ? "Bukti belum cukup untuk menetapkan dugaan pola berulang." : "Tidak ada pola terdeteksi pada sesi ini. Ini bukan kepastian bahwa semua materi sudah dikuasai."}</p>}
    {hasil.ambiguousGroups.map(g=><article key={g.patterns.join("-")} className={card}><h3 className="font-bold">Belum dapat dibedakan: {g.patterns.join(" / ")}</h3><p className="text-sm">{g.shared_answers} jawaban bersama. {g.reason} Kandidat ini tidak berarti siswa pasti mengalami semuanya.</p></article>)}
    {candidates.map(p=><article key={p.pattern} className={card}><div><span className="text-xs font-bold text-turquoise-ink">{labels[p.status]}</span><h3 className="mt-1 text-lg font-extrabold">{p.pattern} · {p.name}</h3></div><p className="text-sm">{p.matching_answers} kecocokan · {p.distinguishing_answers} pembeda · {p.answered_opportunities} kesempatan dijawab</p><ul className="list-disc pl-5 text-sm text-slate-600">{p.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><div className="flex flex-wrap gap-2">{p.examples.map(e=><span key={e.position} className="rounded-lg bg-slate-50 p-2 text-sm">Soal {e.position}: {e.operand_1} {tanda} {e.operand_2} → {e.selected_value} (benar {e.correct_value})</span>)}</div><p className="text-sm text-slate-600">Minta siswa menjelaskan langkah bersusun pada soal serupa.</p></article>)}
    <p className="text-xs text-slate-500">Versi penilaian: {hasil.policyVersion}. {hasil.policyVersion.startsWith("legacy") ? "Status akhir sesi lama dipertahankan; penilaian per pola adalah penjelasan tambahan versi baru." : ""}</p>
  </>;
}
