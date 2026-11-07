import type { Metadata } from "next";
import { Panduan } from "./Panduan";

export const metadata: Metadata = { title: "Panduan Penggunaan" };

export default function HalamanPanduan() {
  return <Panduan />;
}
