import Link from "next/link";
import Image from "next/image";

export type SeoPageData = {
  h1: string;
  intro: string;
  pain: string;
  solution: string;
  resources: string[];
  faqs: { question: string; answer: string }[];
  related: { label: string; href: string }[];
};

export function SeoPageContent({ data }: { data: SeoPageData }) {
  return (
    <main className="marketing-page">
      <SimpleHeader />
      <section className="marketing-hero marketing-hero-simple">
        <div className="marketing-hero-copy">
          <p className="marketing-eyebrow">Frentia</p>
          <h1>{data.h1}</h1>
          <p>{data.intro}</p>
          <div className="marketing-actions">
            <Link href="/cadastro" className="marketing-button marketing-button-primary">
              Cadastro grátis
            </Link>
            <Link href="/contato" className="marketing-button marketing-button-secondary">
              Falar com o Frentia
            </Link>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-split">
          <article>
            <p className="marketing-eyebrow">Dor operacional</p>
            <h2>Quando o campo roda fora do planejamento, a gestão enxerga tarde.</h2>
            <p>{data.pain}</p>
          </article>
          <article>
            <p className="marketing-eyebrow">Como o Frentia resolve</p>
            <h2>O turno vira uma linha de execução acompanhável.</h2>
            <p>{data.solution}</p>
          </article>
        </div>
      </section>

      <section className="marketing-section marketing-section-muted">
        <div className="marketing-section-head">
          <p className="marketing-eyebrow">Recursos relacionados</p>
          <h2>O que entra no fluxo</h2>
        </div>
        <ul className="marketing-resource-list">
          {data.resources.map((resource) => (
            <li key={resource}>{resource}</li>
          ))}
        </ul>
      </section>

      <section className="marketing-section">
        <div className="marketing-section-head">
          <p className="marketing-eyebrow">FAQ</p>
          <h2>Dúvidas frequentes</h2>
        </div>
        <div className="marketing-grid marketing-grid-two">
          {data.faqs.map((faq) => (
            <article className="marketing-card" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section marketing-section-muted">
        <div className="marketing-section-head">
          <p className="marketing-eyebrow">Links relacionados</p>
          <h2>Continue explorando</h2>
        </div>
        <div className="marketing-link-grid">
          {data.related.map((link) => (
            <Link href={link.href} className="marketing-link-card" key={link.href}>
              {link.label}
              <span>Ver página</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="marketing-cta">
        <h2>Comece com uma frente real.</h2>
        <p>Crie seu cadastro grátis e teste o fluxo de planejamento, campo, painel e RDO.</p>
        <Link href="/cadastro" className="marketing-button marketing-button-primary">
          Cadastro grátis
        </Link>
      </section>
      <SimpleFooter />
    </main>
  );
}

export function SimpleHeader() {
  return (
    <header className="frentia-shared-header">
      <div className="frentia-shared-container frentia-shared-nav">
        <Link href="/" className="frentia-shared-brand" aria-label="Frentia">
          <Image
            src="/frentia-logo.png"
            alt="Frentia"
            width={245}
            height={68}
            priority
          />
        </Link>
        <nav className="frentia-shared-menu" aria-label="Navegação principal">
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/#recursos">Recursos</Link>
          <Link href="/#indicadores">Indicadores</Link>
          <Link href="/#planos">Planos</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/blog">Blog</Link>
        </nav>
        <div className="frentia-shared-actions">
          <Link href="/login" className="frentia-shared-btn frentia-shared-btn-login">
            Entrar
          </Link>
          <Link href="/cadastro" className="frentia-shared-btn frentia-shared-btn-primary">
            Começar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SimpleFooter() {
  return (
    <footer className="marketing-footer">
      <span>© 2026 Frentia</span>
      <Link href="/contato">Contato</Link>
      <Link href="/privacidade">Privacidade</Link>
      <Link href="/termos">Termos</Link>
    </footer>
  );
}
