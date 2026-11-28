import { Selo } from "@/components/ui/Selo";

/** Item 5.3: a atividade entrou na semana com restrição aberta; mostra o motivo. */
export function SeloRestricao({ motivo }: { motivo: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Selo tom="alerta">Entrou com restrição</Selo>
      <span className="text-texto-suave">{motivo}</span>
    </p>
  );
}
