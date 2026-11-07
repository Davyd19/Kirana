import type { Metadata } from "next";
import { FormLogin } from "./FormLogin";

export const metadata: Metadata = {
  title: "Masuk sebagai Guru",
};

export default function LoginPage() {
  return <FormLogin />;
}
