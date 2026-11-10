import Link from "next/link";

export const metadata = { title: "Política de privacidade | Frentia" };

export default function Pagina() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-primaria underline">Voltar</Link>
      <h1 className="mt-4 text-2xl font-bold text-primaria">Política de privacidade</h1>
      <div className="mt-4 space-y-4 text-texto-suave">
        <p>Coletamos nome, e-mail e os dados de obra que você registra, apenas para prestar o serviço, conforme a Lei Geral de Proteção de Dados (LGPD).</p>
        <p>Os dados ficam armazenados em provedor de infraestrutura seguro e não são vendidos nem compartilhados com terceiros para publicidade.</p>
        <p>
          Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail{" "}
          <a href="mailto:contato@frentia.com.br" className="text-primaria underline">contato@frentia.com.br</a>.
        </p>
      </div>
    </main>
  );
}
