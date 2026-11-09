import type { Metadata } from "next";
import { SimpleFooter, SimpleHeader } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Política de privacidade | Frentia",
  description:
    "Conheça as diretrizes gerais de privacidade do Frentia para uso do software de controle de execução em campo.",
  alternates: { canonical: "https://www.frentia.com.br/privacidade" },
};

export default function Page() {
  return (
    <main className="marketing-page">
      <SimpleHeader />
      <section className="institutional-hero institutional-hero-simple">
        <div>
          <p className="marketing-eyebrow">Privacidade</p>
          <h1>Política de privacidade</h1>
          <p>
            Diretrizes gerais sobre tratamento de dados no uso do Frentia para controle de
            execução em campo, turnos, restrições, indicadores e RDO.
          </p>
        </div>
      </section>

      <article className="institutional-legal">
        <section className="institutional-card">
          <h2>Dados tratados</h2>
          <p>
            O Frentia trata dados necessários para cadastro, autenticação, operação de turnos,
            apontamentos de campo, suporte e evolução da plataforma.
          </p>
        </section>
        <section className="institutional-card">
          <h2>Finalidade de uso</h2>
          <p>
            As informações registradas no sistema são usadas para viabilizar o controle de
            execução em campo, planejado x realizado, restrições, indicadores e relatórios
            operacionais contratados pelo usuário.
          </p>
        </section>
        <section className="institutional-card">
          <h2>Segurança e melhoria do serviço</h2>
          <p>
            Dados de acesso, operação e suporte podem ser usados para segurança, auditoria,
            melhoria do serviço e cumprimento de obrigações legais aplicáveis.
          </p>
        </section>
        <section className="institutional-card institutional-card-accent">
          <h2>Contato sobre privacidade</h2>
          <p>
            Solicitações relacionadas a privacidade podem ser enviadas para
            contato@frentia.com.br.
          </p>
        </section>
      </article>
      <SimpleFooter />
    </main>
  );
}
