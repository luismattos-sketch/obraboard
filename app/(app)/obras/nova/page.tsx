import { Cartao } from "@/components/ui/Cartao";
import { FormNovaObra } from "./formulario";

export default function NovaObraPage() {
  return (
    <Cartao className="mx-auto w-full max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-primaria">Nova obra</h1>
      <FormNovaObra />
    </Cartao>
  );
}
