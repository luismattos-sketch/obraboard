import type { ReactNode } from "react";
import { classesTom, type Tom } from "./tons";

export function Aviso({ tom, children }: { tom: Tom; children: ReactNode }) {
  return (
    <div
      role={tom === "perigo" || tom === "alerta" ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm ${classesTom[tom]}`}
    >
      {children}
    </div>
  );
}
