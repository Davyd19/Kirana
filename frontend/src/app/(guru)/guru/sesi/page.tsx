import type { Metadata } from "next";
import { DaftarSesi } from "./DaftarSesi";

export const metadata: Metadata = { title: "Sesi Kuis" };

export default function HalamanDaftarSesi() {
  return <DaftarSesi />;
}
