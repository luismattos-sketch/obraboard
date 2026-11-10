import type { ReactNode } from "react";
import type { Tom } from "@/lib/dominio/tipos";
import { classesTom } from "./tons";

export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classesTom[tom]}`}>
      {children}
    </span>
  );
}
