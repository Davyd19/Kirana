/**
 * SIMULASI BACKEND — diagnoser tiruan. Jangan diimpor dari komponen.
 *
 * PLACEHOLDER sampai layanan diagnosis tersedia. Aturannya sederhana dan
 * deterministik, cukup untuk mendemokan lima kondisi di PRD:
 * satu pola, beberapa pola, kemungkinan ambigu, bukti belum cukup, tanpa pola.
 *
 * Istilah:
 * - Soal relevan untuk pola P: soal yang salah satu opsinya dihasilkan P.
 * - Kesempatan: soal relevan yang dijawab dengan memilih opsi.
 * - Pendukung tegas: siswa memilih opsi yang HANYA cocok dengan P.
 * - Pendukung ambigu: siswa memilih opsi yang cocok dengan P dan pola lain.
 */
import type {
  ContohBukti,
  HasilDiagnosis,
  KelompokAmbigu,
  Operasi,
  PolaDidukung,
  Respons,
  RincianJawaban,
  Ringkasan,
} from "@/lib/types";
import type { Paket, SoalPaket } from "./paket-soal";
import { polaUntuk, type DefinisiPola } from "./pola";

/* ---------- Ambang (placeholder, satu tempat) ---------- */

/** Minimal jawaban yang hanya cocok dengan pola tersebut. */
export const AMBANG_PENDUKUNG_TEGAS = 1;
/** Minimal total jawaban pendukung (tegas + ambigu). */
export const AMBANG_PENDUKUNG_TOTAL = 3;
/** Minimal rasio pendukung / kesempatan. */
export const AMBANG_RASIO = 0.3;
/** Minimal jawaban ambigu agar ditampilkan sebagai kemungkinan ambigu. */
export const AMBANG_AMBIGU = 2;
/** Minimal porsi soal relevan yang dijawab agar pengamatan dianggap memadai. */
export const AMBANG_CAKUPAN = 0.5;
/** Jumlah contoh soal yang ditampilkan per pola. */
export const MAKS_CONTOH = 3;

/* ---------- Bantuan ---------- */

const tandaDari = (op: Operasi) => (op === "penjumlahan" ? "+" : "−") as "+" | "−";

function teksProsedur(op: Operasi): string {
  return op === "penjumlahan" ? "melibatkan menyimpan" : "melibatkan meminjam";
}

function teksSoal(op: Operasi): string {
  return op === "penjumlahan" ? "soal menyimpan" : "soal meminjam";
}

function daftarNomor(nomor: number[]): string {
  if (nomor.length <= 1) return nomor.join("");
  return `${nomor.slice(0, -1).join(", ")} dan ${nomor[nomor.length - 1]}`;
}

function nilaiOpsi(soal: SoalPaket, opsiId: string): number {
  return soal.opsi.find((o) => o.id === opsiId)!.nilai;
}

function keContoh(soal: SoalPaket, op: Operasi, pilihan: number): ContohBukti {
  return {
    soalId: soal.id,
    urutan: soal.urutan,
    operandAtas: soal.operandAtas,
    operandBawah: soal.operandBawah,
    tanda: tandaDari(op),
    pilihanSiswa: pilihan,
    jawabanBenar: soal.kunci,
  };
}

interface Pengamatan {
  pola: DefinisiPola;
  relevan: SoalPaket[];
  kesempatan: SoalPaket[];
  tegas: SoalPaket[];
  ambigu: SoalPaket[];
}

/* ---------- Diagnoser ---------- */

export function diagnosis(paket: Paket, respons: Respons[]): HasilDiagnosis {
  const op = paket.operasi;
  const daftarPola = polaUntuk(op);
  const responsUntuk = (s: SoalPaket) => respons.find((r) => r.soalId === s.id);
  const pilihOpsi = (s: SoalPaket) => {
    const r = responsUntuk(s);
    return r && r.jenis === "opsi" ? r.opsiId : null;
  };

  // Ringkasan dan rincian 15 jawaban
  const ringkasan: Ringkasan = { benar: 0, salah: 0, diLuarOpsi: 0, dilewati: 0 };
  const rincian: RincianJawaban[] = paket.soal.map((s) => {
    const r = responsUntuk(s);
    const dasar = {
      urutan: s.urutan,
      operandAtas: s.operandAtas,
      operandBawah: s.operandBawah,
      tanda: tandaDari(op),
      jawabanBenar: s.kunci,
    };
    if (!r || r.jenis === "dilewati") {
      ringkasan.dilewati++;
      return { ...dasar, jenis: "dilewati", pilihanSiswa: null };
    }
    if (r.jenis === "di_luar_opsi") {
      ringkasan.diLuarOpsi++;
      return { ...dasar, jenis: "di_luar_opsi", pilihanSiswa: null };
    }
    const benar = r.opsiId === s.kunciOpsiId;
    if (benar) ringkasan.benar++;
    else ringkasan.salah++;
    return { ...dasar, jenis: benar ? "benar" : "salah", pilihanSiswa: nilaiOpsi(s, r.opsiId) };
  });

  // Pengamatan per pola
  const pengamatan: Pengamatan[] = daftarPola.map((p) => {
    const relevan = paket.soal.filter((s) => Object.values(s.polaOpsi).some((ids) => ids.includes(p.id)));
    const kesempatan = relevan.filter((s) => pilihOpsi(s) !== null);
    const tegas: SoalPaket[] = [];
    const ambigu: SoalPaket[] = [];
    for (const s of kesempatan) {
      const ids = s.polaOpsi[pilihOpsi(s)!] ?? [];
      if (!ids.includes(p.id)) continue;
      if (ids.length === 1) tegas.push(s);
      else ambigu.push(s);
    }
    return { pola: p, relevan, kesempatan, tegas, ambigu };
  });

  const didukung = pengamatan
    .filter((x) => {
      const total = x.tegas.length + x.ambigu.length;
      return (
        x.tegas.length >= AMBANG_PENDUKUNG_TEGAS &&
        total >= AMBANG_PENDUKUNG_TOTAL &&
        x.kesempatan.length > 0 &&
        total / x.kesempatan.length >= AMBANG_RASIO
      );
    })
    // Urutan: pendukung tegas terbanyak, lalu rasio tertinggi.
    .sort(
      (a, b) =>
        b.tegas.length - a.tegas.length ||
        (b.tegas.length + b.ambigu.length) / b.kesempatan.length -
          (a.tegas.length + a.ambigu.length) / a.kesempatan.length,
    );

  const pola: PolaDidukung[] = didukung.map((x) => ({
    id: x.pola.id,
    nama: x.pola.nama,
    jumlahPendukung: x.tegas.length + x.ambigu.length,
    jumlahKesempatan: x.kesempatan.length,
    contoh: [...x.tegas, ...x.ambigu]
      .slice(0, MAKS_CONTOH)
      .sort((a, b) => a.urutan - b.urutan)
      .map((s) => keContoh(s, op, nilaiOpsi(s, pilihOpsi(s)!))),
    saran: x.pola.saran,
  }));

  const kosong = { alasanBelumCukup: null, saranBelumCukup: null, keteranganTanpaPola: null };

  if (pola.length > 0) {
    return { status: "pola_didukung", ringkasan, pola, ambigu: [], ...kosong, rincian };
  }

  // Kemungkinan ambigu: jawaban yang cocok dengan lebih dari satu pola.
  const soalAmbigu = paket.soal.filter((s) => {
    const o = pilihOpsi(s);
    return o !== null && (s.polaOpsi[o]?.length ?? 0) > 1;
  });
  if (soalAmbigu.length >= AMBANG_AMBIGU) {
    const idPola = [...new Set(soalAmbigu.flatMap((s) => s.polaOpsi[pilihOpsi(s)!]))];
    const definisi = daftarPola.filter((p) => idPola.includes(p.id));
    const label = ["A", "B", "C", "D"];

    // Soal pembeda: relevan, dan opsi tiap pola berbeda.
    const pembeda = paket.soal.filter((s) => {
      const nilai = definisi.map((p) => p.terapkan(s.operandAtas, s.operandBawah));
      return nilai.every((v) => v !== null) && new Set(nilai).size === nilai.length;
    });
    const pembedaTerlewat = pembeda.filter((s) => pilihOpsi(s) === null).map((s) => s.urutan);
    const contohPembeda = pembeda[0];
    let saranPembeda = "Minta siswa mengerjakan satu soal sambil bercerita langkah demi langkah.";
    if (contohPembeda) {
      const arah = definisi
        .map((p, i) => `jawaban ${p.terapkan(contohPembeda.operandAtas, contohPembeda.operandBawah)} mengarah ke ${label[i]}`)
        .join(", ");
      saranPembeda = `Minta siswa mengerjakan ${contohPembeda.operandAtas} ${tandaDari(op)} ${contohPembeda.operandBawah} sambil bercerita. ${arah.charAt(0).toUpperCase()}${arah.slice(1)}.`;
    }
    if (pembedaTerlewat.length > 0) {
      saranPembeda += ` Soal ${daftarNomor(pembedaTerlewat)} di kuis ini bisa membedakan, tetapi tidak dijawab dengan memilih opsi.`;
    }

    const kelompok: KelompokAmbigu = {
      pola: definisi.map((p) => ({ id: p.id, nama: p.nama })),
      judul: `${soalAmbigu.length} jawaban cocok dengan ${definisi.length === 2 ? "dua" : definisi.length} kemungkinan`,
      keterangan:
        "Pilihan siswa pada soal ini bisa berasal dari salah satu prosedur di bawah. Jawaban lain belum cukup untuk membedakannya.",
      contoh: soalAmbigu.map((s) => keContoh(s, op, nilaiOpsi(s, pilihOpsi(s)!))),
      saranPembeda,
    };
    return { status: "ambigu", ringkasan, pola: [], ambigu: [kelompok], ...kosong, rincian };
  }

  // Cakupan pengamatan: soal yang relevan untuk setidaknya satu pola.
  const relevan = paket.soal.filter((s) => Object.keys(s.polaOpsi).length > 0);
  const terjawab = relevan.filter((s) => pilihOpsi(s) !== null);
  const dilewati = relevan.filter((s) => {
    const r = responsUntuk(s);
    return !r || r.jenis === "dilewati";
  });
  const diLuar = relevan.filter((s) => responsUntuk(s)?.jenis === "di_luar_opsi");

  if (relevan.length === 0 || terjawab.length / relevan.length < AMBANG_CAKUPAN) {
    const bagian = [`${dilewati.length} dari ${relevan.length} soal yang ${teksProsedur(op)} dilewati`];
    if (diLuar.length > 0) bagian.push(`${diLuar.length} ditandai hasil di luar opsi`);
    let alasan = `${bagian.join(" dan ")}.`;

    // Sebut pola yang sudah punya sedikit bukti, jika ada.
    const terkuat = [...pengamatan].sort(
      (a, b) => b.tegas.length + b.ambigu.length - (a.tegas.length + a.ambigu.length),
    )[0];
    const buktiTerkuat = terkuat ? [...terkuat.tegas, ...terkuat.ambigu].sort((a, b) => a.urutan - b.urutan) : [];
    if (terkuat && buktiTerkuat.length > 0) {
      const contoh = buktiTerkuat
        .map((s) => `soal ${s.urutan}: pilih ${nilaiOpsi(s, pilihOpsi(s)!)}, benar ${s.kunci}`)
        .join("; ");
      alasan += ` Dugaan “${terkuat.pola.nama}” baru didukung ${buktiTerkuat.length} jawaban (${contoh}), belum mencapai ambang bukti.`;
    }
    return {
      status: "belum_cukup",
      ringkasan,
      pola: [],
      ambigu: [],
      alasanBelumCukup: alasan,
      saranBelumCukup: `Tanyakan mengapa soal-soal tersebut tidak dijawab, lalu ajak siswa mengerjakan 2–3 ${teksSoal(op)} bersama.`,
      keteranganTanpaPola: null,
      rincian,
    };
  }

  // Tanpa pola: cakupan memadai, tidak ada pola yang didukung.
  let keterangan = `Cakupan pengamatan memadai: ${terjawab.length} dari ${relevan.length} ${teksSoal(op)} dijawab.`;

  // Bukti lemah (di bawah ambang) tetap disebut agar guru bisa memperhatikannya.
  for (const x of pengamatan) {
    const bukti = [...x.tegas, ...x.ambigu].sort((a, b) => a.urutan - b.urutan);
    if (bukti.length === 0) continue;
    keterangan += ` ${bukti.length === 1 ? "Satu jawaban" : `${bukti.length} jawaban`} (soal ${daftarNomor(bukti.map((s) => s.urutan))}) cocok dengan “${x.pola.nama}”, belum mencapai ambang bukti.`;
  }

  const salahLain = paket.soal
    .filter((s) => {
      const o = pilihOpsi(s);
      return o !== null && o !== s.kunciOpsiId && !s.polaOpsi[o];
    })
    .map((s) => rincian[s.urutan - 1]);
  if (salahLain.length > 0) {
    const daftar = salahLain.map((r) => `soal ${r.urutan}: pilih ${r.pilihanSiswa}, benar ${r.jawabanBenar}`).join("; ");
    keterangan += ` ${salahLain.length === 1 ? "Satu jawaban salah" : `${salahLain.length} jawaban salah`} (${daftar}) tidak cocok dengan pola yang dikenali.`;
  }
  return {
    status: "tanpa_pola",
    ringkasan,
    pola: [],
    ambigu: [],
    alasanBelumCukup: null,
    saranBelumCukup: null,
    keteranganTanpaPola: keterangan,
    rincian,
  };
}
