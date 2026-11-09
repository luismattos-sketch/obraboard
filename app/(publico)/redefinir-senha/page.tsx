import { CascaAuth } from "@/components/ui/CascaAuth";
import { FormRedefinir } from "../formularios";

export const metadata = { title: "Nova senha | Frentia" };

export default function Pagina() {
  return (
    <CascaAuth titulo="Definir nova senha">
      <FormRedefinir />
    </CascaAuth>
  );
}
