import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Varian gaya lama: utama, sekunder, gelap, bahaya.
 * Varian gaya baru: navy, biru (royal blue), coral, turquoise, garis (outline).
 */
export type VarianTombol =
  | "utama"
  | "sekunder"
  | "gelap"
  | "bahaya"
  | "navy"
  | "biru"
  | "coral"
  | "turquoise"
  | "garis";
export type TinggiTombol = 44 | 48 | 52 | 54 | 56;

const VARIAN: Record<VarianTombol, string> = {
  utama: "rounded-input font-bold bg-primary text-white hover:bg-primary-hover",
  sekunder: "rounded-input font-bold bg-surface text-ink border-[1.5px] border-border-strong hover:bg-page",
  gelap: "rounded-input font-bold bg-ink text-white hover:bg-ink-2",
  bahaya: "rounded-input font-bold bg-surface text-danger border-[1.5px] border-danger hover:bg-danger-soft",
  navy: "rounded-xl bg-navy text-white font-extrabold shadow-sm hover:bg-navy-hover",
  biru: "rounded-2xl bg-royal-blue text-white font-extrabold shadow-md hover:bg-royal-blue-hover",
  coral: "rounded-2xl bg-coral-red text-white font-extrabold shadow-md hover:bg-coral-red-hover",
  turquoise: "rounded-xl bg-turquoise text-navy font-extrabold hover:brightness-95",
  garis: "rounded-2xl font-bold border-2 border-slate-200 bg-white text-navy hover:bg-slate-50",
};

const TINGGI: Record<TinggiTombol, string> = {
  44: "h-11 px-5 text-[15px]",
  48: "h-12 px-5 text-[15px]",
  52: "h-[52px] px-5 text-[15px]",
  54: "h-[54px] px-5 text-base",
  56: "h-14 px-[26px] text-base",
};

export function kelasTombol({
  varian = "utama",
  tinggi = 48,
  penuh = false,
}: {
  varian?: VarianTombol;
  tinggi?: TinggiTombol;
  penuh?: boolean;
} = {}): string {
  return [
    "inline-flex items-center justify-center gap-2 no-underline box-border transition-colors",
    "disabled:bg-disabled disabled:text-ink-2 disabled:border-transparent disabled:cursor-not-allowed disabled:shadow-none",
    "aria-busy:cursor-progress aria-busy:opacity-75",
    VARIAN[varian],
    TINGGI[tinggi],
    penuh ? "w-full" : "",
  ].join(" ");
}

interface GayaTombol {
  varian?: VarianTombol;
  tinggi?: TinggiTombol;
  penuh?: boolean;
}

export function Tombol({
  varian,
  tinggi,
  penuh,
  className = "",
  type = "button",
  ...rest
}: GayaTombol & ComponentProps<"button">) {
  return <button type={type} className={`${kelasTombol({ varian, tinggi, penuh })} ${className}`} {...rest} />;
}

export function TombolLink({
  varian,
  tinggi,
  penuh,
  className = "",
  ...rest
}: GayaTombol & ComponentProps<typeof Link>) {
  return <Link className={`${kelasTombol({ varian, tinggi, penuh })} ${className}`} {...rest} />;
}
