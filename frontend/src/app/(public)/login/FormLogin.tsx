"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AksiBawah, CatatanDemoBaru, KartuSiswa, SiswaLayout } from "@/components/layout/SiswaLayout";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Tombol, TombolLink } from "@/components/ui/Tombol";
import { KiranaError } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { masuk } from "@/services/kirana";

type Fase = "diam" | "memuat" | "gagal" | "berhasil";

const kelasInput = (galat: boolean) =>
  `box-border h-12 w-full rounded-xl bg-slate-50 px-3.5 text-sm font-semibold text-navy focus:border-turquoise focus:bg-white ${
    galat ? "border-2 border-danger" : "border border-slate-200"
  }`;

export function FormLogin() {
  const router = useRouter();
  const auth = useAuth();

  const [email, setEmail] = useState("guru@kirana.demo");
  const [sandi, setSandi] = useState("");
  const [tampilSandi, setTampilSandi] = useState(false);
  const [dicoba, setDicoba] = useState(false);
  const [fase, setFase] = useState<Fase>("diam");
  const [pesanGagal, setPesanGagal] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const sandiRef = useRef<HTMLInputElement>(null);

  // Sudah login sebelumnya: langsung ke dashboard.
  const sudahMasuk = !!auth && fase !== "berhasil";
  useEffect(() => {
    if (sudahMasuk) router.replace("/guru/dashboard");
  }, [sudahMasuk, router]);

  const emailKosong = dicoba && !email.trim();
  const sandiKosong = dicoba && !sandi;

  function ubah(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      if (fase === "gagal") setFase("diam");
    };
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (fase === "memuat" || fase === "berhasil") return; // cegah klik ganda
    setDicoba(true);
    if (!email.trim()) return emailRef.current?.focus();
    if (!sandi) return sandiRef.current?.focus();

    setFase("memuat");
    try {
      await masuk(email, sandi);
      setFase("berhasil");
      router.replace("/guru/dashboard");
    } catch (err) {
      setPesanGagal(
        err instanceof KiranaError ? err.message : "Belum bisa masuk. Silakan coba lagi.",
      );
      setFase("gagal");
    }
  }

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
      <KartuSiswa labelledBy="judul-login">
        <div className="flex flex-col items-center gap-1">
          <Link href="/" aria-label="Kirana, kembali ke beranda" className="mb-2 no-underline">
            <Logo tinggi={54} prioritas />
          </Link>
          <h1 id="judul-login" className="m-0 text-2xl font-extrabold text-navy">
            Masuk sebagai Guru
          </h1>
          <p className="m-0 text-xs text-slate-500">Kelola sesi kuis dan lihat dugaan pola kesalahan siswa.</p>
        </div>

        <CatatanDemoBaru>
          <span className="font-bold">Data demo:</span> login lokal tanpa keamanan produksi. Gunakan{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-bold">guru@kirana.demo</code> dengan kata sandi apa
          saja.
        </CatatanDemoBaru>

        {fase === "gagal" && <ErrorBanner id="login-galat">{pesanGagal}</ErrorBanner>}

        <form noValidate onSubmit={kirim} className="flex flex-col gap-4 text-left" aria-busy={fase === "memuat"}>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-bold text-navy">
              Email Guru
            </label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => ubah(setEmail)(e.target.value)}
              aria-invalid={emailKosong}
              aria-describedby={emailKosong ? "email-pesan" : fase === "gagal" ? "login-galat" : undefined}
              className={kelasInput(emailKosong)}
            />
            {emailKosong && (
              <span id="email-pesan" role="alert" className="text-xs font-semibold text-danger">
                Isi email terlebih dahulu.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="sandi" className="text-xs font-bold text-navy">
              Kata Sandi
            </label>
            <div className="relative">
              <input
                ref={sandiRef}
                id="sandi"
                type={tampilSandi ? "text" : "password"}
                autoComplete="current-password"
                value={sandi}
                onChange={(e) => ubah(setSandi)(e.target.value)}
                aria-invalid={sandiKosong}
                aria-describedby={sandiKosong ? "sandi-pesan" : fase === "gagal" ? "login-galat" : undefined}
                className={`${kelasInput(sandiKosong)} pr-14`}
              />
              <button
                type="button"
                onClick={() => setTampilSandi((t) => !t)}
                aria-label={tampilSandi ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                aria-pressed={tampilSandi}
                className="absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-xl border-0 bg-transparent text-slate-600 hover:text-navy"
              >
                <Icon nama={tampilSandi ? "mata-tutup" : "mata"} />
              </button>
            </div>
            {sandiKosong && (
              <span id="sandi-pesan" role="alert" className="text-xs font-semibold text-danger">
                Isi kata sandi terlebih dahulu.
              </span>
            )}
          </div>

          <AksiBawah>
            {fase === "berhasil" ? (
              <div role="status" className="flex flex-col gap-2.5">
                <span className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <Icon nama="centang" ukuran={18} tebal={3} />
                  Berhasil masuk.
                </span>
                <TombolLink href="/guru/dashboard" varian="biru" penuh tinggi={52}>
                  Buka Dashboard
                </TombolLink>
              </div>
            ) : (
              <Tombol
                type="submit"
                varian="biru"
                penuh
                tinggi={52}
                className="mt-2"
                aria-disabled={fase === "memuat"}
                aria-busy={fase === "memuat"}
              >
                {fase === "memuat" ? "Memeriksa akun…" : "Masuk"}
                {fase !== "memuat" && <Icon nama="panah-kanan" ukuran={16} tebal={2.5} />}
              </Tombol>
            )}
          </AksiBawah>
        </form>

        <p className="m-0 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Siswa tidak perlu akun.{" "}
          <Link href="/join" className="font-bold text-turquoise-ink hover:underline">
            Masuk kuis di sini
          </Link>
        </p>
      </KartuSiswa>
    </SiswaLayout>
  );
}
