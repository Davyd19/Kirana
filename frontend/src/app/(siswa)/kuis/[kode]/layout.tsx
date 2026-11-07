import type { ReactNode } from "react";
import { KuisProvider } from "./KuisProvider";

export default function LayoutKuis({ children }: { children: ReactNode }) {
  return <KuisProvider>{children}</KuisProvider>;
}
