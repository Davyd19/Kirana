"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalkanKode } from "@/lib/kode";
import { KiranaError, type Attempt, type SesiSiswa, type Soal } from "@/lib/types";
import { ambilAttempt, ambilInfoSesi, ambilSoal } from "@/services/kirana";

export type KeadaanKuis =
  | { fase: "memuat" }
  | { fase: "tidak_valid" }
  | { fase: "jaringan"; pesan: string }
  | { fase: "siap"; sesi: SesiSiswa; soal: Soal[]; attempt: Attempt | null };

interface NilaiKuis {
  kode: string | null;
  keadaan: KeadaanKuis;
  muatUlang: () => void;
  setAttempt: (a: Attempt) => void;
}

const KuisContext = createContext<NilaiKuis | null>(null);

/**
 * Memuat sesi, paket soal, dan progres siswa SEKALI untuk semua rute
 * /kuis/[kode]/*, supaya pindah antarsoal tidak memuat ulang data.
 * Kode di URL dinormalkan (misalnya "krn4821" -> "KRN-4821").
 */
export function KuisProvider({ children }: { children: ReactNode }) {
  const params = useParams<{ kode: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const mentah = decodeURIComponent(params.kode ?? "");
  const kode = normalkanKode(mentah);
  const [hasil, setHasil] = useState<{ untuk: string; keadaan: KeadaanKuis } | null>(null);
  const [percobaan, setPercobaan] = useState(0);

  // Samakan URL dengan bentuk kode yang baku.
  useEffect(() => {
    if (kode && kode !== mentah) {
      const bagian = pathname.split("/");
      bagian[2] = kode;
      router.replace(bagian.join("/"));
    }
  }, [kode, mentah, pathname, router]);

  const kunci = `${kode ?? ""}#${percobaan}`;

  useEffect(() => {
    if (!kode) return;
    let batal = false;
    Promise.all([ambilInfoSesi(kode), ambilSoal(kode), ambilAttempt(kode)])
      .then(([sesi, soal, attempt]) => {
        if (!batal) setHasil({ untuk: kunci, keadaan: { fase: "siap", sesi, soal, attempt } });
      })
      .catch((err) => {
        if (batal) return;
        const keadaan: KeadaanKuis =
          err instanceof KiranaError && err.kodeError === "kode_tidak_ditemukan"
            ? { fase: "tidak_valid" }
            : { fase: "jaringan", pesan: err instanceof Error ? err.message : "Koneksi sedang terganggu." };
        setHasil({ untuk: kunci, keadaan });
      });
    return () => {
      batal = true;
    };
  }, [kode, kunci]);

  const keadaan = useMemo<KeadaanKuis>(
    () => (!kode ? { fase: "tidak_valid" } : hasil && hasil.untuk === kunci ? hasil.keadaan : { fase: "memuat" }),
    [kode, hasil, kunci],
  );

  const muatUlang = useCallback(() => setPercobaan((n) => n + 1), []);

  const setAttempt = useCallback((attempt: Attempt) => {
    setHasil((h) => (h && h.keadaan.fase === "siap" ? { ...h, keadaan: { ...h.keadaan, attempt } } : h));
  }, []);

  const nilai = useMemo(() => ({ kode, keadaan, muatUlang, setAttempt }), [kode, keadaan, muatUlang, setAttempt]);

  return <KuisContext.Provider value={nilai}>{children}</KuisContext.Provider>;
}

export function useKuis(): NilaiKuis {
  const v = useContext(KuisContext);
  if (!v) throw new Error("useKuis harus dipakai di dalam KuisProvider.");
  return v;
}
