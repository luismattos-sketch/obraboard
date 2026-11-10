import Link from "next/link";

export const metadata = { title: "Termos de uso | Frentia" };

export default function Pagina() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-operacional underline">Voltar</Link>
      <h1 className="mt-4 text-titulo font-semibold text-primaria">Termos de uso</h1>
      <div className="mt-4 space-y-4 text-texto-suave">
        <p>O Frentia é um serviço para planejamento de turnos, registro de execução e geração de Relatório Diário de Obra (RDO).</p>
        <p>Você é responsável pelas informações que lança e por manter suas credenciais em sigilo. O serviço é oferecido no estado em que se encontra, durante a fase de lançamento, e pode mudar sem aviso prévio.</p>
        <p>Você pode encerrar o uso a qualquer momento. Dúvidas sobre estes termos podem ser enviadas para{" "}
          <a href="mailto:contato@frentia.com.br" className="text-operacional underline">contato@frentia.com.br</a>.
        </p>
      </div>
    </main>
  );
}
