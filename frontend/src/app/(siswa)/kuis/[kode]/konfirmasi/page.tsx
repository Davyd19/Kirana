import type { Metadata } from "next";
import { Ringkasan } from "./Ringkasan";

export const metadata: Metadata = { title: "Kumpulkan jawaban" };

export default function HalamanKonfirmasi() {
  return <Ringkasan />;
}
