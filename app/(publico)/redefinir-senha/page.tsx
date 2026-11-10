import { redirect } from "next/navigation";
import { CascaAuth } from "@/components/ui/CascaAuth";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { FormRedefinir } from "../formularios";

export const metadata = { title: "Nova senha | Frentia" };

export default async function Pagina() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?erro=link-expirado");
  return (
    <CascaAuth titulo="Definir nova senha">
      <FormRedefinir />
    </CascaAuth>
  );
}
