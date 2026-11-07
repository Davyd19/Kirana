import type { Metadata } from "next";
import { IsiNama } from "./IsiNama";

export const metadata: Metadata = { title: "Isi nama" };

export default function HalamanIsiNama() {
  return <IsiNama />;
}
