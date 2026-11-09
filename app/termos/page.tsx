import type { Metadata } from "next";
import { SimpleFooter, SimpleHeader } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Termos de uso | Frentia",
  description:
    "Consulte os termos gerais de uso do Frentia, software para controle de execução em campo.",
  alternates: { canonical: "https://www.frentia.com.br/termos" },
};

export default function Page() {
  return (
    <main className="marketing-page">
      <SimpleHeader />
      <section className="institutional-hero institutional-hero-simple">
        <div>
          <p className="marketing-eyebrow">Termos</p>
          <h1>Termos de uso</h1>
          <p>
            Condições gerais para uso do Frentia como software de controle de execução em
            campo, turnos, apontamentos, restrições, indicadores e RDO.
          </p>
        </div>
      </section>

      <article className="institutional-legal">
        <section className="institutional-card">
          <h2>Uso da plataforma</h2>
          <p>
            O Frentia é disponibilizado para apoiar o controle de execução em campo,
            planejamento de turnos, apontamentos operacionais, restrições, indicadores e RDO.
          </p>
        </section>
        <section className="institutional-card">
          <h2>Responsabilidade do usuário</h2>
          <p>
            O usuário é responsável por manter suas credenciais seguras e por registrar
            informações verdadeiras e adequadas à operação acompanhada pela plataforma.
          </p>
        </section>
        <section className="institutional-card">
          <h2>Acesso de campo por QR Code</h2>
          <p>
            A tela Campo por QR Code deve ser compartilhada apenas com pessoas autorizadas a
            apontar informações do turno correspondente.
          </p>
        </section>
        <section className="institutional-card institutional-card-accent">
          <h2>Atualizações do serviço</h2>
          <p>
            O uso da plataforma pode ser atualizado conforme evolução do produto, requisitos
            técnicos e condições comerciais aplicáveis.
          </p>
        </section>
      </article>
      <SimpleFooter />
    </main>
  );
}
