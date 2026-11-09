import { CascaAuth } from "@/components/ui/CascaAuth";
import { FormRecuperar } from "../formularios";

export const metadata = { title: "Recuperar senha | Frentia" };

export default function Pagina() {
  return (
    <CascaAuth titulo="Recuperar senha">
      <FormRecuperar />
    </CascaAuth>
  );
}
