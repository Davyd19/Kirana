import type { Metadata } from "next";
import { KerjakanSoal } from "./KerjakanSoal";

export const metadata: Metadata = { title: "Mengerjakan soal" };

export default function HalamanKerjakan() {
  return <KerjakanSoal />;
}
