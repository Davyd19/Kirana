import type { Metadata } from "next";
import { DetailDiagnosis } from "./DetailDiagnosis";

export const metadata: Metadata = { title: "Detail diagnosis" };

export default function HalamanDetailDiagnosis() {
  return <DetailDiagnosis />;
}
