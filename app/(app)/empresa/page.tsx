import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { obterNomeEmpresa } from "@/lib/db/empresas";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { NomeEmpresa } from "./NomeEmpresa";

export default async function EmpresaPage() {
  const nome = await obterNomeEmpresa(await criarClienteServidor());
  return (
    <div className="flex min-w-0 max-w-xl flex-col gap-4">
      <h1 className="text-titulo font-semibold text-primaria">Minha empresa</h1>
      {nome === null ? (
        <Aviso tom="perigo">Não foi possível carregar a empresa. Tente novamente.</Aviso>
      ) : (
        <Cartao className="flex flex-col gap-4">
          <NomeEmpresa inicial={nome} />
          <Aviso tom="info">Trocar o logo do Frentia pelo da sua empresa: disponível no plano pago (em breve)</Aviso>
        </Cartao>
      )}
    </div>
  );
}
