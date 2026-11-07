"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AksiBawah, GelembungInfo, KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol } from "@/components/ui/Tombol";
import { normalkanKode } from "@/lib/kode";
import { KiranaError } from "@/lib/types";
import { ambilSesiDenganKode } from "@/services/kirana";

type Galat =
  | { jenis: "kosong" | "format" | "tidak_ditemukan" | "ditutup"; pesan: string }
  | { jenis: "jaringan"; pesan: string };



/** A3 · Masuk kuis dengan kode manual (desain baru). */
export function FormJoin() {
  const router = useRouter();
  const [kode, setKode] = useState("");
  const [galat, setGalat] = useState<Galat | null>(null);
  const [memuat, setMemuat] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cek(e?: FormEvent) {
    e?.preventDefault();
    if (memuat) return;
    if (!kode.trim()) {
      setGalat({ jenis: "kosong", pesan: "Isi kode kuis terlebih dahulu." });
      inputRef.current?.focus();
      return;
    }
    const normal = normalkanKode(kode);
    if (!normal) {
      setGalat({ jenis: "format", pesan: "Kode kuis tidak ditemukan. Periksa kembali kode yang dimasukkan." });
      inputRef.current?.focus();
      return;
    }

    setMemuat(true);
    setGalat(null);
    try {
      const sesi = await ambilSesiDenganKode(normal);
      if (sesi.status !== "terbuka") {
        setGalat({ jenis: "ditutup", pesan: "Sesi kuis ini sudah ditutup oleh guru." });
        setMemuat(false);
        return;
      }
      router.push(`/kuis/${sesi.kode}`);
    } catch (err) {
      const k = err instanceof KiranaError ? err : null;
      if (k?.kodeError === "kode_tidak_ditemukan") {
        setGalat({ jenis: "tidak_ditemukan", pesan: k.message });
        inputRef.current?.focus();
      } else {
        setGalat({ jenis: "jaringan", pesan: k?.message ?? "Koneksi sedang terganggu. Silakan coba lagi." });
      }
      setMemuat(false);
    }
  }

  const galatField = galat && galat.jenis !== "jaringan";

  return (
    <SiswaLayout
      atas={
        <Link
          href="/"
          className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-turquoise-ink no-underline hover:text-navy"
        >
          <Icon nama="panah-kiri" ukuran={16} tebal={2.5} />
          Kembali ke beranda
        </Link>
      }
    >
      <KartuSiswa labelledBy="judul-join">
        <div className="animasi-melayang mx-auto flex h-24 items-center justify-center">
          <Logo tinggi={88} tanpaNama prioritas />
        </div>

        <GelembungInfo>“Masukkan kode dari gurumu ya!”</GelembungInfo>

        <div className="flex flex-col gap-1">
          <h1 id="judul-join" className="m-0 text-2xl font-extrabold text-navy">
            Masuk Kuis
          </h1>
          <p className="m-0 text-xs text-slate-500">
            Ketik kode kuis dari gurumu. Kalau punya QR atau tautan, cukup buka itu saja.
          </p>
        </div>

        {galat?.jenis === "jaringan" && (
          <ErrorBanner
            aksi={
              <button type="button" onClick={() => cek()} className="min-h-11 font-bold text-danger underline">
                Coba lagi
              </button>
            }
          >
            {galat.pesan}
          </ErrorBanner>
        )}

        <form noValidate onSubmit={cek} className="flex flex-col gap-4" aria-busy={memuat}>
          <div className="flex flex-col gap-1 text-left">
            <label htmlFor="kode" className="text-xs font-bold text-navy">
              Kode Kuis
            </label>
            <input
              ref={inputRef}
              id="kode"
              value={kode}
              onChange={(e) => {
                setKode(e.target.value.toUpperCase());
                if (galatField) setGalat(null);
              }}
              placeholder="KRN-ABC234"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={!!galatField}
              aria-describedby={galatField ? "kode-pesan" : undefined}
              className={`angka box-border h-14 w-full rounded-2xl bg-slate-50 px-4 text-center text-xl font-extrabold tracking-widest text-navy placeholder:text-slate-400 focus:bg-white ${
                galatField ? "border-2 border-danger" : "border-2 border-turquoise"
              }`}
            />
            {galatField && (
              <span id="kode-pesan" role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <Icon nama={galat.jenis === "ditutup" ? "gembok" : "peringatan"} ukuran={16} tebal={2.5} />
                {galat.pesan}
              </span>
            )}
          </div>



          <AksiBawah>
            <Tombol type="submit" varian="coral" penuh tinggi={52} aria-busy={memuat} aria-disabled={memuat}>
              {memuat ? "Memeriksa kode…" : "Cek Kode"}
            </Tombol>
          </AksiBawah>
        </form>
      </KartuSiswa>
    </SiswaLayout>
  );
}
