"use client";

import MedicaoShell from "../_components/MedicaoShell";

export default function MedicaoMedirPage() {
  return (
    <MedicaoShell>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Medição operacional
          </p>

          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            Medir
          </h3>

          <p className="mt-2 max-w-3xl text-slate-600">
            Esta subpágina será usada para lançar, revisar e acompanhar as
            medições executadas. A lógica de medição será desenvolvida aos
            poucos aqui, sem interferir nos demais fluxos do aplicativo.
          </p>
        </div>
      </section>
    </MedicaoShell>
  );
}
