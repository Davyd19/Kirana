import type { Metadata } from "next";
import { BuatSesi } from "./BuatSesi";

export const metadata: Metadata = { title: "Buat sesi" };

export default function HalamanBuatSesi() {
  return <BuatSesi />;
}
