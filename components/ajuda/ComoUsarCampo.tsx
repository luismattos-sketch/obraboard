import { PassoAjuda } from "@/components/ajuda/PassoAjuda";
import { capituloPorSlug } from "@/lib/ajuda/capitulos";

/** "Como usar" do link de campo: acordeão nativo com os passos do capítulo do campo (nada guardado no navegador). */
export function ComoUsarCampo() {
  const cap = capituloPorSlug("campo")!;
  return (
    <details className="rounded-cartao border border-borda bg-superficie">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-operacional underline">Como usar</summary>
      <div className="flex flex-col gap-6 border-t border-borda px-4 py-4">
        {cap.passos.map((p, i) => <PassoAjuda key={p.id} slug="campo" passo={p} numero={i + 1} />)}
      </div>
    </details>
  );
}
