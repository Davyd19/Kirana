"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HasilMuat<T> =
  | { status: "memuat" }
  | { status: "gagal"; pesan: string }
  | { status: "siap"; data: T };

/**
 * Memuat data async dari service (client-only, aman dari hydration mismatch
 * karena render pertama selalu "memuat").
 * `kunci` menentukan kapan data dimuat ulang; `muatUlang()` memaksa memuat lagi.
 * `segarkan()` memuat ulang tanpa kembali ke status "memuat" (data lama tetap tampil).
 */
export function useMuat<T>(muat: () => Promise<T>, kunci: string) {
  const loader = useRef(muat);
  useEffect(() => { loader.current = muat; });
  const [percobaan, setPercobaan] = useState(0);
  const [hasil, setHasil] = useState<{ untuk: string; nilai: HasilMuat<T> } | null>(null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const kunciPenuh = `${kunci}#${percobaan}`;

  useEffect(() => {
    let batal = false;
    muat()
      .then((data) => {
        if (!batal) setHasil({ untuk: kunciPenuh, nilai: { status: "siap", data } });
      })
      .catch((err: unknown) => {
        if (!batal)
          setHasil({
            untuk: kunciPenuh,
            nilai: { status: "gagal", pesan: err instanceof Error ? err.message : "Data belum berhasil dimuat." },
          });
      })
      .finally(() => {
        if (!batal) setMenyegarkan(false);
      });
    return () => {
      batal = true;
    };
    // `muat` sengaja tidak dijadikan dependensi: pemanggil menyatakan perubahan lewat `kunci`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciPenuh]);

  useEffect(() => {
    let active = true;
    let pending = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible" || !window.location.pathname.startsWith("/guru/") || pending) return;
      pending = true;
      try {
        const data = await loader.current();
        if (active) setHasil({ untuk: kunciPenuh, nilai: { status: "siap", data } });
      } catch { /* Keep the last result; manual refresh exposes a persistent error. */ }
      finally { pending = false; }
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [kunciPenuh]);

  const muatUlang = useCallback(() => setPercobaan((n) => n + 1), []);

  // Pertahankan data lama selama penyegaran.
  const [dataLama, setDataLama] = useState<{ untuk: string; nilai: HasilMuat<T> } | null>(null);
  const segarkan = useCallback(() => {
    setMenyegarkan(true);
    setDataLama(hasil);
    setPercobaan((n) => n + 1);
  }, [hasil]);

  let nilai: HasilMuat<T> = { status: "memuat" };
  if (hasil && hasil.untuk === kunciPenuh) nilai = hasil.nilai;
  else if (menyegarkan && dataLama) nilai = dataLama.nilai;

  return { hasil: nilai, muatUlang, segarkan, menyegarkan };
}
