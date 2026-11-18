import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import { Cartao } from "@/components/ui/Cartao";
import { FormNovaObra } from "./formulario";

export default function NovaObraPage() {
  return (
    <Cartao className="mx-auto w-full max-w-lg">
      <div className="flex items-start justify-between gap-2 mb-4">
        <h1 className="text-titulo font-semibold text-primaria">Nova obra</h1>
        <BotaoAjuda tela="obras" />
      </div>
      <FormNovaObra />
    </Cartao>
  );
}
