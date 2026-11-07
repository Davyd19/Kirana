import type { ReactNode } from "react";
import { GuruLayout } from "@/components/layout/GuruLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <GuruLayout>{children}</GuruLayout>;
}
