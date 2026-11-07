import type { Metadata } from "next";
import { HasilSesi } from "../HasilSesi";

export const metadata: Metadata = { title: "Hasil & Diagnosis" };

export default function HalamanHasilSesi() {
  return <HasilSesi />;
}
