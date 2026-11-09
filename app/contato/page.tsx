import type { Metadata } from "next";
import Link from "next/link";
import { SimpleFooter, SimpleHeader } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Contato | Frentia",
  description:
    "Fale com o Frentia para conhecer o controle de execução em campo para obras, frentes de serviço e paradas industriais.",
  alternates: { canonical: "https://www.frentia.com.br/contato" },
};

export default function Page() {
  return (
    <main className="marketing-page">
      <SimpleHeader />
      <section className="institutional-hero">
        <div>
          <p className="marketing-eyebrow">Contato</p>
          <h1>Fale com o Frentia</h1>
          <p>
            Quer controlar execução em campo, planejado x realizado, restrições e RDO em
            uma frente real? Comece pelo cadastro grátis ou fale com nossa equipe.
          </p>
          <div className="marketing-actions">
            <Link href="/cadastro" className="marketing-button marketing-button-primary">
              Cadastro grátis
            </Link>
            <a href="mailto:contato@frentia.com.br" className="marketing-button marketing-button-secondary">
              contato@frentia.com.br
            </a>
          </div>
        </div>
        <aside className="institutional-panel" aria-label="Canais de contato">
          <span className="institutional-panel-kicker">Frentia</span>
          <h2>Operação em campo com visibilidade de turno.</h2>
          <p>
            Use o contato para falar sobre implantação, dúvidas comerciais ou teste do
            fluxo em uma frente real.
          </p>
          <div className="institutional-contact-card">
            <strong>E-mail</strong>
            <a href="mailto:contato@frentia.com.br">contato@frentia.com.br</a>
          </div>
        </aside>
      </section>

      <section className="institutional-section">
        <div className="institutional-grid">
          <article className="institutional-card">
            <h2>Para obras e frentes de serviço</h2>
            <p>
              Converse sobre controle de turno, QR Code para campo, restrições e painel de
              planejado x realizado.
            </p>
          </article>
          <article className="institutional-card">
            <h2>Para paradas industriais</h2>
            <p>
              Entenda como acompanhar frentes críticas durante janelas curtas de execução.
            </p>
          </article>
          <article className="institutional-card">
            <h2>Para teste grátis</h2>
            <p>
              Crie o cadastro e valide o fluxo completo: check-in, campo, painel, checkout e RDO.
            </p>
          </article>
        </div>
      </section>
      <SimpleFooter />
    </main>
  );
}
