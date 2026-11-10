import type { HTMLAttributes } from "react";

export function Cartao({ className = "", ...resto }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={`rounded-xl border border-borda bg-superficie p-5 shadow-sm ${className}`}
    />
  );
}
