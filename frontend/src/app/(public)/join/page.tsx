import type { Metadata } from "next";
import { FormJoin } from "./FormJoin";

export const metadata: Metadata = { title: "Masuk kuis" };

export default function JoinPage() {
  return <FormJoin />;
}
