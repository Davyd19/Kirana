import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Kotak keterangan mode demo (garis putus-putus oranye), seperti di A2. */
export function CatatanDemo({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-input border border-dashed border-luar bg-demo-soft px-3.5 py-3 text-sm leading-[1.45] text-demo-ink">
      <Icon nama="info" ukuran={18} className="mt-px flex-none" />
      <span>{children}</span>
    </div>
  );
}
