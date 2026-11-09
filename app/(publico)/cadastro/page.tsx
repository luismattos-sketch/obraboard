import { CascaAuth } from "@/components/ui/CascaAuth";
import { FormCadastro } from "../formularios";

export const metadata = { title: "Criar conta | Frentia" };

export default function Pagina() {
  return (
    <CascaAuth titulo="Criar conta grátis">
      <FormCadastro />
    </CascaAuth>
  );
}
