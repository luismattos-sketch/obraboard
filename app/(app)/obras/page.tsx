import Link from "next/link";
import { Cartao } from "@/components/ui/Cartao";
import { classesBotao } from "@/components/ui/Botao";
import { listarObras } from "@/lib/db/obras";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function ObrasPage() {
  const obras = await listarObras(await criarClienteServidor());

  if (obras.length === 0) {
    return (
      <Cartao className="mx-auto flex w-full max-w-lg flex-col items-start gap-3">
        <h1 className="text-titulo font-semibold text-primaria">Cadastre sua primeira obra</h1>
        <p className="text-texto-suave">Crie a obra para começar a planejar as frentes de trabalho.</p>
        <Link href="/obras/nova" className={classesBotao()}>Nova obra</Link>
      </Cartao>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-titulo font-semibold text-primaria">Obras</h1>
        <Link href="/obras/nova" className={classesBotao()}>Nova obra</Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {obras.map((o) => (
          <li key={o.id}>
            <Link href={`/obras/${o.id}`} className="block rounded-cartao focus-visible:outline-2 focus-visible:outline-operacional">
              <Cartao className="transition-colors hover:bg-primaria-clara">
                <h2 className="text-lg font-semibold text-primaria">{o.nome}</h2>
                {o.cliente && <p className="text-sm text-texto-suave">{o.cliente}</p>}
              </Cartao>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
