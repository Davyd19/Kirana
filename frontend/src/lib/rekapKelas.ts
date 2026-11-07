import type { HasilSiswa, NumberCategory, PatternAssessment } from "@/lib/types";

/**
 * Rekap kelas: mengakumulasi hasil diagnosis seluruh siswa satu sesi.
 * Metode sama dengan ml/simulasi_akumulasi_kelas.py (cara "jumlah skor model"):
 * perkiraan jumlah siswa per pola = jumlah skor model seluruh siswa.
 */
export const MIN_PENGUMPULAN = 10;
export const BATAS_KELAS = 0.25;
export const MAKS_PRIORITAS = 3;

const PERLU_DICEK: PatternAssessment["status"][] = ["preliminary", "ambiguous"];

export interface PolaRekap {
  pola: string;
  nama: string;
  /** Jumlah skor model seluruh siswa; null jika model tidak aktif untuk sebagian siswa. */
  perkiraan: number | null;
  pasti: HasilSiswa[];
  perluDicek: HasilSiswa[];
}

export interface SiswaDicek {
  siswa: HasilSiswa;
  pola: { pola: string; nama: string; soal: number[] }[];
}

export interface RekapKelas {
  jumlah: number;
  modelAktif: boolean;
  dataSedikit: boolean;
  pola: PolaRekap[];
  prioritas: PolaRekap[];
  siswaDicek: SiswaDicek[];
  tanpaTanda: HasilSiswa[];
  /** Siswa dengan minimal satu "Pola didukung". adaPasti + siswaDicek + tanpaTanda = jumlah. */
  adaPasti: number;
}

export function hitungRekap(hasil: HasilSiswa[]): RekapKelas {
  const modelAktif = hasil.length > 0 && hasil.every((h) => h.modelAktif);
  const peta = new Map<string, PolaRekap>();
  for (const h of hasil) {
    for (const a of h.penilaian) {
      if (a.status === "not_measurable") continue;
      const p = peta.get(a.pattern) ?? { pola: a.pattern, nama: a.name, perkiraan: modelAktif ? 0 : null, pasti: [], perluDicek: [] };
      if (p.perkiraan !== null) p.perkiraan += a.score ?? 0;
      if (a.status === "supported") p.pasti.push(h);
      else if (PERLU_DICEK.includes(a.status)) p.perluDicek.push(h);
      peta.set(a.pattern, p);
    }
  }
  const bobot = (p: PolaRekap) => p.perkiraan ?? p.pasti.length + p.perluDicek.length;
  const pola = [...peta.values()].sort((a, b) => bobot(b) - bobot(a) || a.pola.localeCompare(b.pola));
  // Minimal ≈1 siswa (0,5) agar kelas sangat kecil tidak menghasilkan prioritas "≈0 siswa".
  const batasPrioritas = Math.max(BATAS_KELAS * hasil.length, 0.5);
  const prioritas = modelAktif
    ? pola.filter((p) => (p.perkiraan ?? 0) >= batasPrioritas).slice(0, MAKS_PRIORITAS)
    : [];

  const siswaDicek: SiswaDicek[] = [];
  const tanpaTanda: HasilSiswa[] = [];
  for (const h of hasil) {
    if (h.penilaian.some((a) => a.status === "supported")) continue;
    const dugaan = h.penilaian.filter((a) => PERLU_DICEK.includes(a.status));
    if (dugaan.length === 0) {
      tanpaTanda.push(h);
      continue;
    }
    dugaan.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.matching_answers - a.matching_answers);
    siswaDicek.push({ siswa: h, pola: dugaan.map((a) => ({ pola: a.pattern, nama: a.name, soal: a.examples.map((e) => e.position) })) });
  }
  const adaPasti = hasil.length - siswaDicek.length - tanpaTanda.length;
  return { jumlah: hasil.length, modelAktif, dataSedikit: hasil.length < MIN_PENGUMPULAN, pola, prioritas, siswaDicek, tanpaTanda, adaPasti };
}

/** Kelas dianggap "sebagian besar bersih" jika ≥70% siswa tanpa tanda kesalahan berulang. */
export const BATAS_SIAP_LANJUT = 0.7;

const KATEGORI_BERIKUT: Record<NumberCategory, string> = {
  tens: "kategori Ratusan",
  hundreds: "kategori Ribuan",
  thousands: "soal yang lebih menantang",
};

export interface GambaranKelas {
  kesimpulan: string;
  langkah: string[];
}

const label = (p: PolaRekap) => `${p.pola} (${p.nama.charAt(0).toLowerCase()}${p.nama.slice(1)})`;
const gabung = (teks: string[]) => (teks.length <= 1 ? teks.join("") : `${teks.slice(0, -1).join(", ")} dan ${teks.at(-1)}`);

/** Kesimpulan satu kalimat + maksimal 3 langkah, disusun dari hasil hitungRekap. */
export function gambaranKelas(r: RekapKelas, kategori: NumberCategory | null): GambaranKelas {
  const berikut = kategori ? KATEGORI_BERIKUT[kategori] : "materi berikutnya";
  const masihBermasalah = r.jumlah - r.tanpaTanda.length;
  let kesimpulan: string;
  if (!r.modelAktif) {
    kesimpulan = `Model diagnosis belum aktif, sehingga masalah utama kelas belum dapat diperkirakan. ${masihBermasalah} dari ${r.jumlah} siswa menunjukkan tanda awal pola menurut aturan hitung.`;
  } else if (r.dataSedikit) {
    kesimpulan = `Baru ${r.jumlah} siswa mengumpulkan, belum cukup untuk menyimpulkan kondisi kelas. Sementara ini: ${r.adaPasti} siswa dengan pola pasti, ${r.siswaDicek.length} perlu dicek, ${r.tanpaTanda.length} tanpa tanda kesalahan berulang.`;
  } else if (r.prioritas.length > 0) {
    const [utama, ...lain] = r.prioritas;
    kesimpulan = `Masalah terbesar kelas ini adalah ${label(utama)}, dialami sekitar ${Math.round(utama.perkiraan ?? 0)} dari ${r.jumlah} siswa.`
      + (lain.length ? ` Disusul ${gabung(lain.map((p) => `${p.pola} (≈${Math.round(p.perkiraan ?? 0)} siswa)`))}.` : "")
      + ` Fokuskan pertemuan berikutnya pada ${utama.pola}.`;
  } else if (r.tanpaTanda.length >= BATAS_SIAP_LANJUT * r.jumlah) {
    kesimpulan = `Sebagian besar kelas (${r.tanpaTanda.length} dari ${r.jumlah} siswa) tidak menunjukkan kesalahan berulang. Kelas siap lanjut ke ${berikut}`
      + (masihBermasalah ? `, sambil mendampingi ${masihBermasalah} siswa yang masih bermasalah.` : ".");
  } else if (r.adaPasti === 0) {
    kesimpulan = `Belum ada pola kesalahan yang terkonfirmasi di kelas ini, tetapi ${r.siswaDicek.length} dari ${r.jumlah} siswa menunjukkan tanda awal. Cek siswa tersebut dulu sebelum memutuskan materi yang perlu diajarkan ulang.`;
  } else {
    kesimpulan = `Kesalahan di kelas ini tersebar: tidak ada satu pola yang dialami ${Math.round(BATAS_KELAS * 100)}% siswa atau lebih. Tangani lewat kelompok kecil per pola, bukan pengajaran ulang seluruh kelas.`;
  }

  const langkah: string[] = [];
  if (r.prioritas.length) langkah.push(`Ajarkan ulang ${gabung(r.prioritas.map((p) => p.pola))} ke seluruh kelas.`);
  // Kelompok kecil hanya dari pola pasti; siswa yang belum pasti ditangani di langkah "cek" agar tidak terhitung dua kali.
  const kecil = r.pola.filter((p) => !r.prioritas.includes(p) && p.pasti.length > 0)
    .sort((a, b) => b.pasti.length - a.pasti.length || a.pola.localeCompare(b.pola)).slice(0, 2);
  if (kecil.length) langkah.push(`Buat kelompok kecil untuk ${gabung(kecil.map((p) => `${p.pola} (${p.pasti.length} siswa)`))}.`);
  if (r.siswaDicek.length) langkah.push(`Cek ${r.siswaDicek.length} siswa yang belum pasti: minta mereka mengerjakan ulang soal buktinya sambil menjelaskan langkahnya.`);
  if (!langkah.length) langkah.push(`Lanjutkan ke ${berikut}.`);
  return { kesimpulan, langkah: langkah.slice(0, 3) };
}
