import type { Metadata } from "next";
import { DetailSesi } from "./DetailSesi";

export const metadata: Metadata = { title: "Detail sesi" };

export default function HalamanDetailSesi() {
  return <DetailSesi />;
}
