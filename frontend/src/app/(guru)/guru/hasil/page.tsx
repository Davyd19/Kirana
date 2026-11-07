import type { Metadata } from "next";
import { HasilSesi } from "./HasilSesi";

export const metadata: Metadata = { title: "Hasil & Diagnosis" };

/** Tanpa sesi terpilih: tampilkan sesi terbaru. */
export default function HalamanHasil() {
  return <HasilSesi />;
}
