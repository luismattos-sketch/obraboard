import { CascaAuth } from "@/components/ui/CascaAuth";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { FormLogin } from "../formularios";

export const metadata = { title: "Entrar | Frentia" };

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string; aviso?: string }>;
}) {
  const { proximo, erro, aviso } = await searchParams;
  return (
    <CascaAuth titulo="Entrar">
      <FormLogin
        proximo={caminhoSeguro(proximo)}
        sucesso={aviso === "email-confirmado" ? "E-mail confirmado. Entre com sua senha." : undefined}
        aviso={erro === "link-expirado" ? "O link expirou ou é inválido. Peça um novo." : undefined}
      />
    </CascaAuth>
  );
}
