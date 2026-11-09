import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const siteUrl = "https://www.frentia.com.br";

export const metadata: Metadata = {
  title: "Frentia | Controle de execução em campo para obras e paradas industriais",
  description:
    "Controle o planejado x realizado em tempo real. Publique turnos por QR Code, registre restrições e acompanhe a execução da frente no painel.",
  alternates: {
    canonical: `${siteUrl}/`,
  },
  openGraph: {
    title: "Frentia | Controle de execução em campo",
    description:
      "Veja o planejado x realizado, registre restrições e acompanhe o turno em tempo real.",
    url: siteUrl,
    type: "website",
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Frentia",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Software para controle de execução em campo, planejado x realizado, apontamento por QR Code, restrições e acompanhamento de turno.",
  url: siteUrl,
};

const featureLinks = [
  ["Controle de execução em campo", "/controle-execucao-campo"],
  ["Planejado x realizado", "/planejado-vs-realizado"],
  ["RDO digital", "/rdo-digital"],
  ["Controle de turno", "/controle-turno-obra"],
  ["Gestão de restrições", "/gestao-restricoes-obra"],
  ["Paradas industriais", "/software-gestao-paradas-industriais"],
];

export default function LandingPage() {
  return (
    <main className="frentia-landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .frentia-landing {
              --azul-frentia: #062B63;
              --azul-profundo: #041F49;
              --azul-noite: #031733;
              --azul-claro: #EAF2FF;
              --azul-borda: #C9DCF7;
              --laranja-frentia: #FF6B00;
              --laranja-escuro: #D85A00;
              --laranja-claro: #FFF1E6;
              --cinza-900: #172033;
              --cinza-700: #4D5A6D;
              --cinza-500: #7B8794;
              --cinza-200: #E6EAF0;
              --cinza-100: #F6F8FB;
              --branco: #FFFFFF;
              --verde: #17A673;
              --sombra: 0 18px 45px rgba(4, 31, 73, 0.14);
              --sombra-suave: 0 12px 32px rgba(4, 31, 73, 0.08);
              color: var(--cinza-900);
              background: var(--branco);
              font-family: Inter, Arial, Helvetica, sans-serif;
              line-height: 1.55;
            }
            .frentia-landing * { box-sizing: border-box; }
            .frentia-landing a { color: inherit; text-decoration: none; }
            .frentia-landing .container { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
            .frentia-landing header {
              position: sticky; top: 0; z-index: 50;
              background: rgba(255, 255, 255, 0.92);
              backdrop-filter: blur(14px);
              border-bottom: 1px solid rgba(230, 234, 240, 0.9);
            }
            .frentia-landing .nav { height: 92px; display: flex; align-items: center; justify-content: space-between; gap: 22px; }
            .frentia-landing .brand { display: inline-flex; align-items: center; flex-shrink: 0; }
            .frentia-landing .brand img { width: 245px; height: auto; max-height: 68px; object-fit: contain; }
            .frentia-landing .menu { display: flex; align-items: center; gap: 24px; color: var(--cinza-700); font-size: 0.94rem; font-weight: 800; }
            .frentia-landing .menu a:hover { color: var(--azul-frentia); }
            .frentia-landing .nav-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
            .frentia-landing .btn {
              display: inline-flex; align-items: center; justify-content: center;
              min-height: 44px; border-radius: 999px; padding: 13px 20px;
              font-size: 0.95rem; font-weight: 900; line-height: 1; white-space: nowrap;
              transition: 0.2s ease;
            }
            .frentia-landing .btn-primary { background: var(--laranja-frentia); color: var(--branco); box-shadow: 0 14px 28px rgba(255, 107, 0, 0.26); }
            .frentia-landing .btn-primary:hover { background: var(--laranja-escuro); transform: translateY(-2px); }
            .frentia-landing .btn-secondary { background: var(--azul-claro); color: var(--azul-frentia); }
            .frentia-landing .btn-login { background: var(--branco); color: var(--azul-frentia); border: 1px solid var(--cinza-200); box-shadow: 0 8px 20px rgba(4,31,73,0.06); }
            .frentia-landing .hero {
              overflow: hidden; position: relative; padding: 78px 0 68px;
              background:
                radial-gradient(circle at 7% 5%, rgba(255, 107, 0, 0.13), transparent 26%),
                radial-gradient(circle at 88% 16%, rgba(6, 43, 99, 0.15), transparent 31%),
                linear-gradient(180deg, #FFFFFF 0%, #F6F8FB 100%);
            }
            .frentia-landing .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; align-items: center; }
            .frentia-landing .tag {
              display: inline-flex; align-items: center; gap: 9px; margin-bottom: 18px;
              border-radius: 999px; padding: 8px 13px;
              background: var(--laranja-claro); color: #A94700;
              font-size: 0.86rem; font-weight: 900;
            }
            .frentia-landing .tag span { width: 8px; height: 8px; border-radius: 999px; background: var(--laranja-frentia); }
            .frentia-landing h1 { max-width: 760px; margin: 0 0 22px; color: var(--azul-profundo); font-size: clamp(2.35rem, 4.3vw, 4.55rem); font-weight: 1000; line-height: 1.02; }
            .frentia-landing h2 { margin: 0 0 16px; color: var(--azul-profundo); font-size: clamp(2rem, 3vw, 3.1rem); font-weight: 1000; line-height: 1.05; }
            .frentia-landing h3 { margin: 0 0 8px; color: var(--azul-profundo); font-weight: 950; }
            .frentia-landing p { margin: 0; color: var(--cinza-700); }
            .frentia-landing .hero p { max-width: 650px; margin-bottom: 30px; font-size: 1.12rem; }
            .frentia-landing .hero-actions { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-bottom: 24px; }
            .frentia-landing .microcopy { color: var(--cinza-500); font-size: 0.93rem; font-weight: 700; }
            .frentia-landing .proof-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 26px; }
            .frentia-landing .proof-pill { border: 1px solid var(--cinza-200); border-radius: 999px; padding: 9px 12px; background: var(--branco); color: var(--azul-profundo); font-size: 0.86rem; font-weight: 900; box-shadow: 0 8px 20px rgba(4,31,73,0.04); }
            .frentia-landing .hero-card { border: 1px solid rgba(230,234,240,0.9); border-radius: 32px; padding: 16px; background: rgba(255,255,255,0.94); box-shadow: var(--sombra); transform: rotate(1deg); }
            .frentia-landing .product-window { min-height: 520px; display: grid; grid-template-columns: 92px 1fr; overflow: hidden; border: 1px solid var(--cinza-200); border-radius: 24px; background: #EDF2F8; }
            .frentia-landing .fake-sidebar { display: flex; flex-direction: column; gap: 12px; padding: 15px 10px; background: var(--azul-noite); color: rgba(255,255,255,0.78); }
            .frentia-landing .fake-logo { margin-bottom: 8px; border-radius: 8px; padding: 8px; background: var(--branco); color: var(--azul-frentia); text-align: center; font-size: 0.84rem; font-weight: 900; }
            .frentia-landing .fake-menu { display: grid; gap: 7px; }
            .frentia-landing .fake-menu span { border-radius: 9px; padding: 8px 7px; font-size: 0.72rem; font-weight: 900; }
            .frentia-landing .fake-menu .active { background: var(--laranja-frentia); color: var(--branco); }
            .frentia-landing .fake-main { display: grid; gap: 13px; padding: 16px; }
            .frentia-landing .fake-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 18px; padding: 15px; background: var(--branco); box-shadow: 0 8px 18px rgba(4,31,73,0.05); }
            .frentia-landing .fake-top small { color: var(--cinza-500); font-weight: 800; }
            .frentia-landing .clock { border: 1px solid var(--azul-borda); border-radius: 11px; padding: 9px 11px; background: var(--azul-claro); color: var(--azul-frentia); font-weight: 900; }
            .frentia-landing .fake-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
            .frentia-landing .kpi { border: 1px solid var(--cinza-200); border-radius: 15px; padding: 13px; background: var(--branco); }
            .frentia-landing .kpi small { color: var(--cinza-500); font-size: 0.72rem; font-weight: 900; text-transform: uppercase; }
            .frentia-landing .kpi strong { display: block; margin-top: 3px; color: var(--azul-frentia); font-size: 1.45rem; line-height: 1.15; }
            .frentia-landing .fake-content { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px; }
            .frentia-landing .fake-panel, .frentia-landing .qr-card { border: 1px solid var(--cinza-200); border-radius: 18px; padding: 15px; background: var(--branco); box-shadow: 0 8px 18px rgba(4,31,73,0.04); }
            .frentia-landing .mini-bar { height: 8px; overflow: hidden; border-radius: 999px; background: var(--cinza-200); }
            .frentia-landing .mini-bar span { display: block; height: 100%; border-radius: 999px; background: var(--verde); }
            .frentia-landing .mini-bar.orange span { background: var(--laranja-frentia); }
            .frentia-landing .resource-bars { display: grid; gap: 10px; margin-top: 12px; }
            .frentia-landing .bar-label { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 5px; color: var(--cinza-900); font-size: 0.82rem; font-weight: 900; }
            .frentia-landing .qr { width: 118px; height: 118px; margin: 12px auto; border: 8px solid var(--branco); border-radius: 14px; background: var(--branco); box-shadow: 0 0 0 1px var(--cinza-200), 0 10px 22px rgba(4,31,73,0.08); }
            .frentia-landing .qr img { display: block; width: 100%; height: 100%; object-fit: contain; }
            .frentia-landing .qr-button { display: block; width: 100%; border-radius: 11px; padding: 10px; background: var(--laranja-frentia); color: var(--branco); text-align: center; font-size: 0.82rem; font-weight: 900; }
            .frentia-landing section { padding: 86px 0; }
            .frentia-landing .section-head { max-width: 820px; margin: 0 auto 44px; text-align: center; }
            .frentia-landing .section-head p { font-size: 1.08rem; }
            .frentia-landing .eyebrow { margin-bottom: 10px; color: var(--laranja-frentia); font-size: 0.78rem; font-weight: 1000; letter-spacing: 0.12em; text-transform: uppercase; }
            .frentia-landing .pain-grid { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 26px; align-items: stretch; }
            .frentia-landing .pain-lead { border-radius: 32px; padding: 34px; background: var(--azul-profundo); color: var(--branco); box-shadow: var(--sombra); }
            .frentia-landing .pain-lead h2, .frentia-landing .field h2, .frentia-landing .cta h2 { color: var(--branco); }
            .frentia-landing .pain-lead p, .frentia-landing .field p, .frentia-landing .cta p { color: rgba(255,255,255,0.82); }
            .frentia-landing .pain-list, .frentia-landing .field-list { display: grid; gap: 16px; }
            .frentia-landing .pain-item { display: grid; grid-template-columns: 46px 1fr; gap: 16px; border: 1px solid var(--cinza-200); border-radius: 22px; padding: 24px; background: var(--cinza-100); }
            .frentia-landing .pain-icon { display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 15px; background: var(--laranja-claro); color: var(--laranja-escuro); font-weight: 1000; }
            .frentia-landing .flow, .frentia-landing .indicators, .frentia-landing .pricing, .frentia-landing .seo-links { background: linear-gradient(180deg, #FFFFFF 0%, #F6F8FB 100%); }
            .frentia-landing .steps { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
            .frentia-landing .step, .frentia-landing .module-card, .frentia-landing .audience-card, .frentia-landing .faq, .frentia-landing .price, .frentia-landing .seo-card { border: 1px solid var(--cinza-200); border-radius: 22px; padding: 22px; background: var(--branco); box-shadow: var(--sombra-suave); }
            .frentia-landing .step-num { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; margin-bottom: 18px; border-radius: 14px; background: var(--azul-claro); color: var(--azul-frentia); font-weight: 1000; }
            .frentia-landing .step.highlight { background: var(--azul-profundo); color: var(--branco); border-color: var(--azul-profundo); }
            .frentia-landing .step.highlight h3, .frentia-landing .step.highlight p { color: var(--branco); }
            .frentia-landing .modules-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .frentia-landing .module-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
            .frentia-landing .module-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 16px; background: var(--azul-claro); color: var(--azul-frentia); font-weight: 1000; }
            .frentia-landing .module-pill { border-radius: 999px; padding: 6px 10px; background: var(--cinza-100); color: var(--cinza-700); font-size: 0.76rem; font-weight: 900; }
            .frentia-landing .screen-mini { display: grid; gap: 8px; margin-top: 18px; border: 1px solid var(--cinza-200); border-radius: 16px; padding: 10px; background: #F3F6FA; }
            .frentia-landing .mini-row { height: 12px; border: 1px solid var(--cinza-200); border-radius: 999px; background: var(--branco); }
            .frentia-landing .mini-row.short { width: 58%; }
            .frentia-landing .mini-row.mid { width: 78%; }
            .frentia-landing .mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .frentia-landing .mini-box { height: 48px; border: 1px solid var(--cinza-200); border-radius: 12px; background: var(--branco); }
            .frentia-landing .field { background: var(--azul-profundo); color: var(--branco); }
            .frentia-landing .field-grid, .frentia-landing .indicator-layout { display: grid; grid-template-columns: 1fr 0.92fr; gap: 42px; align-items: center; }
            .frentia-landing .field-item { display: grid; grid-template-columns: 36px 1fr; gap: 13px; color: rgba(255,255,255,0.9); }
            .frentia-landing .check-dot { width: 36px; height: 36px; border: 1px solid rgba(255,255,255,0.13); border-radius: 12px; background: rgba(255,255,255,0.1); }
            .frentia-landing .phone { width: min(360px, 100%); margin: 0 auto; border: 10px solid rgba(255,255,255,0.12); border-radius: 38px; padding: 16px; background: #0A234F; box-shadow: 0 28px 70px rgba(0,0,0,0.28); }
            .frentia-landing .phone-screen { display: grid; gap: 12px; border-radius: 28px; padding: 18px; background: var(--branco); color: var(--cinza-900); }
            .frentia-landing .phone-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
            .frentia-landing .phone-chip { border-radius: 999px; padding: 6px 9px; background: #E7F8F1; color: var(--verde); font-size: 0.72rem; font-weight: 1000; }
            .frentia-landing .task-card { display: grid; gap: 9px; border: 1px solid var(--cinza-200); border-radius: 16px; padding: 12px; }
            .frentia-landing .phone-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .frentia-landing .phone-btn { border-radius: 11px; padding: 10px; background: var(--azul-claro); color: var(--azul-frentia); text-align: center; font-size: 0.76rem; font-weight: 1000; }
            .frentia-landing .phone-btn.primary { background: var(--laranja-frentia); color: var(--branco); }
            .frentia-landing .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 24px; }
            .frentia-landing .metric-card { border: 1px solid var(--cinza-200); border-radius: 20px; padding: 20px; background: var(--branco); box-shadow: var(--sombra-suave); }
            .frentia-landing .metric-card small { color: var(--cinza-500); font-size: 0.72rem; font-weight: 1000; text-transform: uppercase; }
            .frentia-landing .metric-card strong { display: block; margin-top: 6px; color: var(--azul-frentia); font-size: 2rem; line-height: 1; }
            .frentia-landing .charts { border: 1px solid var(--cinza-200); border-radius: 30px; padding: 26px; background: var(--branco); box-shadow: var(--sombra); }
            .frentia-landing .bars { display: flex; align-items: end; gap: 18px; height: 190px; border-radius: 18px; padding: 18px; background: var(--cinza-100); }
            .frentia-landing .bar-col { flex: 1; min-height: 30px; border-radius: 12px 12px 6px 6px; background: var(--azul-frentia); }
            .frentia-landing .bar-col:nth-child(1) { height: 84px; }
            .frentia-landing .bar-col:nth-child(2) { height: 128px; background: var(--laranja-frentia); }
            .frentia-landing .bar-col:nth-child(3) { height: 154px; }
            .frentia-landing .bar-col:nth-child(4) { height: 60px; background: var(--verde); }
            .frentia-landing .audience-grid, .frentia-landing .faq-grid, .frentia-landing .seo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
            .frentia-landing .price-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; align-items: stretch; }
            .frentia-landing .price { display: flex; flex-direction: column; gap: 18px; padding: 30px; }
            .frentia-landing .price.featured { border: 2px solid var(--laranja-frentia); transform: translateY(-10px); }
            .frentia-landing .amount { color: var(--azul-frentia); font-size: 2.4rem; font-weight: 1000; }
            .frentia-landing .price ul { display: grid; gap: 11px; margin: 0; padding: 0; list-style: none; color: var(--cinza-700); }
            .frentia-landing .price li { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; }
            .frentia-landing .price li::before { content: "✓"; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-top: 2px; border-radius: 999px; background: var(--azul-claro); color: var(--azul-frentia); font-size: 0.76rem; font-weight: 1000; line-height: 1; }
            .frentia-landing .price.featured li::before { background: var(--laranja-claro); color: var(--laranja-escuro); }
            .frentia-landing .price .btn { margin-top: auto; width: 100%; }
            .frentia-landing .cta { background: var(--azul-profundo); text-align: center; }
            .frentia-landing .cta p { max-width: 700px; margin: 0 auto 24px; }
            .frentia-landing footer { border-top: 1px solid var(--cinza-200); padding: 28px 0; background: var(--branco); }
            .frentia-landing .footer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; color: var(--cinza-500); font-size: 0.92rem; font-weight: 800; }
            .frentia-landing .footer-links { display: flex; flex-wrap: wrap; gap: 14px; }
            @media (max-width: 1020px) {
              .frentia-landing .nav { height: auto; flex-wrap: wrap; padding: 16px 0; }
              .frentia-landing .menu { order: 3; width: 100%; overflow-x: auto; padding-bottom: 4px; }
              .frentia-landing .hero-grid, .frentia-landing .pain-grid, .frentia-landing .field-grid, .frentia-landing .indicator-layout { grid-template-columns: 1fr; }
              .frentia-landing .steps, .frentia-landing .modules-grid, .frentia-landing .audience-grid, .frentia-landing .faq-grid, .frentia-landing .price-cards, .frentia-landing .seo-grid { grid-template-columns: 1fr; }
              .frentia-landing .price.featured { transform: none; }
            }
            @media (max-width: 620px) {
              .frentia-landing .container { width: min(100% - 28px, 1180px); }
              .frentia-landing .brand img { width: 190px; }
              .frentia-landing .nav-actions { width: 100%; }
              .frentia-landing .nav-actions .btn { flex: 1; }
              .frentia-landing .product-window { min-height: auto; grid-template-columns: 1fr; }
              .frentia-landing .fake-sidebar { display: none; }
              .frentia-landing .fake-kpis, .frentia-landing .fake-content, .frentia-landing .metric-grid { grid-template-columns: 1fr; }
            }
          `,
        }}
      />

      <header>
        <div className="container nav">
          <Link href="/" className="brand" aria-label="Frentia">
            <Image
              src="/frentia-logo.png"
              alt="Frentia"
              width={245}
              height={68}
              priority
            />
          </Link>
          <nav className="menu" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#indicadores">Indicadores</a>
            <a href="#planos">Planos</a>
            <a href="#faq">FAQ</a>
            <Link href="/blog">Blog</Link>
          </nav>
          <div className="nav-actions">
            <Link href="/login" className="btn btn-login">
              Entrar
            </Link>
            <Link href="/cadastro" className="btn btn-primary">
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="tag">
              <span />
              Campo, painel e RDO no mesmo fluxo
            </div>
            <h1>Controle a execução da sua frente em tempo real, do check-in ao RDO</h1>
            <p>
              Publique turnos por QR Code, acompanhe o planejado x realizado, registre
              restrições e transforme o apontamento de campo em decisão durante o turno.
            </p>
            <div className="hero-actions">
              <Link href="/cadastro" className="btn btn-primary">
                Começar grátis
              </Link>
              <a href="#como-funciona" className="btn btn-secondary">
                Ver fluxo operacional
              </a>
            </div>
            <p className="microcopy">
              O planejador acessa com login. O encarregado entra pelo QR Code no celular.
            </p>
            <div className="proof-row">
              <span className="proof-pill">Turnos por QR Code</span>
              <span className="proof-pill">Restrições em campo</span>
              <span className="proof-pill">Painel em tempo real</span>
              <span className="proof-pill">Base para RDO</span>
            </div>
          </div>

          <div className="hero-card" aria-label="Exemplo visual do painel Frentia">
            <div className="product-window">
              <aside className="fake-sidebar">
                <div className="fake-logo">Frentia</div>
                <div className="fake-menu">
                  <span>Obra</span>
                  <span>Check-in</span>
                  <span className="active">Painel</span>
                  <span>Campo</span>
                  <span>RDO</span>
                </div>
              </aside>
              <div className="fake-main">
                <div className="fake-top">
                  <div>
                    <h3>Painel Frentia</h3>
                    <small>Frente: Montagem Industrial - Turno 1</small>
                  </div>
                  <div className="clock">08:42</div>
                </div>
                <div className="fake-kpis">
                  <div className="kpi"><small>Atividades</small><strong>18</strong></div>
                  <div className="kpi"><small>Execução</small><strong>7</strong></div>
                  <div className="kpi"><small>Restrições</small><strong>2</strong></div>
                  <div className="kpi"><small>Real</small><strong>64%</strong></div>
                </div>
                <div className="fake-content">
                  <div className="fake-panel">
                    <h4>Recursos previsto x real</h4>
                    <div className="resource-bars">
                      <div>
                        <div className="bar-label"><span>Caldeireiro</span><span>82%</span></div>
                        <div className="mini-bar"><span style={{ width: "82%" }} /></div>
                      </div>
                      <div>
                        <div className="bar-label"><span>Soldador</span><span>68%</span></div>
                        <div className="mini-bar orange"><span style={{ width: "68%" }} /></div>
                      </div>
                      <div>
                        <div className="bar-label"><span>Montador</span><span>91%</span></div>
                        <div className="mini-bar"><span style={{ width: "91%" }} /></div>
                      </div>
                    </div>
                  </div>
                  <div className="qr-card">
                    <h4>Campo da frente ativa</h4>
                    <p>QR Code publicado para o encarregado apontar o turno.</p>
                    <div className="qr">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="https://api.qrserver.com/v1/create-qr-code/?data=https%3A%2F%2Fwww.frentia.com.br%2Fcadastro&size=180x180&margin=8"
                        alt="QR Code para abrir a página de cadastro do Frentia"
                        width="102"
                        height="102"
                      />
                    </div>
                    <span className="qr-button">Abrir Campo</span>
                  </div>
                </div>
                <div className="fake-panel">
                  <h4>Atividades do turno</h4>
                  <div className="screen-mini">
                    <div className="mini-row" />
                    <div className="mini-row mid" />
                    <div className="mini-row short" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pain">
        <div className="container pain-grid">
          <div className="pain-lead">
            <div className="eyebrow">Dor operacional</div>
            <h2>A execução não pode depender de mensagem solta.</h2>
            <p>
              Quando o campo informa tarde, o planejador perde a chance de corrigir rota
              durante o turno. O Frentia coloca o dado operacional no painel enquanto a
              frente ainda está trabalhando.
            </p>
          </div>
          <div className="pain-list">
            {[
              ["01", "Planejado x realizado atrasado", "Veja avanço, status e recursos sem esperar fechamento manual."],
              ["02", "Restrições sem rastreabilidade", "Registre impedimentos no turno, ligados à frente e à atividade."],
              ["03", "RDO montado no retrabalho", "Use o histórico do turno para apoiar o relatório diário."],
            ].map(([num, title, text]) => (
              <article className="pain-item" key={title}>
                <div className="pain-icon">{num}</div>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="flow" id="como-funciona">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Como funciona</div>
            <h2>Do check-in ao RDO em uma linha clara.</h2>
            <p>
              O fluxo foi desenhado para a rotina real de obras, frentes de serviço e
              paradas industriais.
            </p>
          </div>
          <div className="steps">
            {[
              ["1", "Crie a obra", "Cadastre a frente, disciplinas, responsáveis e dados operacionais."],
              ["2", "Planeje o turno", "Defina atividades, recursos, metas e prioridades antes da execução."],
              ["3", "Publique o QR Code", "O encarregado acessa a tela Campo pelo celular sem login."],
              ["4", "Acompanhe o painel", "Veja status, tempo, recursos, restrições e avanço real."],
              ["5", "Valide no checkout", "Feche pendências, parciais e tratativas do turno."],
              ["6", "Gere o RDO", "Transforme registros do turno em histórico operacional."],
            ].map(([num, title, text], index) => (
              <article className={`step ${index === 2 ? "highlight" : ""}`} key={title}>
                <div className="step-num">{num}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="recursos">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Recursos</div>
            <h2>O que o Frentia entrega na operação.</h2>
            <p>
              As telas conectam planejamento, campo, painel, restrições e fechamento sem
              alterar a lógica simples do QR Code para quem executa.
            </p>
          </div>
          <div className="modules-grid">
            {[
              ["CF", "Cadastro da Frente", "Base operacional", "Centralize dados da frente, disciplinas, funções, turnos e responsáveis."],
              ["CI", "Check-in Operacional", "Planejamento", "Defina atividades do turno, recursos disponíveis, metas e observações."],
              ["QR", "Tela Campo via QR Code", "Campo", "O encarregado lança recursos, inicia atividades e registra restrições pelo celular."],
              ["PF", "Painel Frentia", "Tempo real", "Acompanhe execução, parciais, finalizadas, restrições e recursos previsto x real."],
              ["CO", "Check-out do Turno", "Fechamento", "Valide atividades, trate restrições e reprograme pendências com rastreabilidade."],
              ["RDO", "RDO digital", "Histórico", "Consolide resumo, recursos, atividades do turno, restrições e evidências."],
            ].map(([icon, title, pill, text]) => (
              <article className="module-card" key={title}>
                <div className="module-head">
                  <div className="module-icon">{icon}</div>
                  <span className="module-pill">{pill}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="screen-mini">
                  <div className="mini-row" />
                  <div className="mini-row mid" />
                  <div className="mini-grid">
                    <div className="mini-box" />
                    <div className="mini-box" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="field">
        <div className="container field-grid">
          <div>
            <div className="eyebrow">Campo conectado</div>
            <h2>O planejador tem conta. O campo só precisa do QR Code.</h2>
            <p>
              Quem planeja acessa o sistema com login, publica o turno e compartilha o QR
              Code. O encarregado abre a tela Campo no celular e alimenta o painel com dados
              da execução.
            </p>
            <div className="field-list">
              {[
                "Acesso simples para o encarregado, sem senha e sem instalação.",
                "Dados vinculados ao turno ativo publicado pelo planejador.",
                "Recursos, restrições, início, finalização e quantitativos no painel.",
              ].map((item) => (
                <div className="field-item" key={item}>
                  <div className="check-dot" />
                  <div><strong>{item}</strong></div>
                </div>
              ))}
            </div>
          </div>
          <div className="phone" aria-label="Exemplo de tela campo no celular">
            <div className="phone-screen">
              <div className="phone-top">
                <div>
                  <strong>Campo · Turno 1</strong>
                  <br />
                  <small>Manutenção</small>
                </div>
                <span className="phone-chip">Ativo</span>
              </div>
              <div className="task-card">
                <h4>Montagem de estrutura</h4>
                <div className="mini-row" />
                <div className="mini-row short" />
                <div className="phone-actions">
                  <div className="phone-btn primary">Iniciar</div>
                  <div className="phone-btn">Restrição</div>
                </div>
              </div>
              <div className="task-card">
                <h4>Recursos mobilizados</h4>
                <div className="mini-row mid" />
                <div className="mini-row short" />
              </div>
              <div className="phone-actions">
                <div className="phone-btn">Salvar avanço</div>
                <div className="phone-btn primary">Finalizar</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="indicators" id="indicadores">
        <div className="container indicator-layout">
          <div>
            <div className="eyebrow">Indicadores</div>
            <h2>Um painel visual para decidir durante o turno, não depois dele.</h2>
            <p>
              Veja HH planejado x consumido, avanço real, PPC, tempo produtivo, tempo parado,
              restrições abertas e linha do tempo da execução.
            </p>
            <div className="metric-grid">
              <div className="metric-card"><small>HH consumido</small><strong>232,3</strong></div>
              <div className="metric-card"><small>Avanço real</small><strong>40%</strong></div>
              <div className="metric-card"><small>Restrições abertas</small><strong>2</strong></div>
              <div className="metric-card"><small>PPC</small><strong>68%</strong></div>
            </div>
          </div>
          <div className="charts">
            <h3>Planejado x Real</h3>
            <div className="bars">
              <div className="bar-col" />
              <div className="bar-col" />
              <div className="bar-col" />
              <div className="bar-col" />
            </div>
          </div>
        </div>
      </section>

      <section className="seo-links">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Casos de uso</div>
            <h2>Explore o Frentia por necessidade operacional.</h2>
          </div>
          <div className="seo-grid">
            {featureLinks.map(([label, href]) => (
              <Link href={href} className="seo-card" key={href}>
                <h3>{label}</h3>
                <p>Saiba como o Frentia apoia esse fluxo.</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Onde usar</div>
            <h2>Feito para operações que precisam enxergar a execução.</h2>
          </div>
          <div className="audience-grid">
            {[
              ["Manutenção industrial", "Controle equipes, impedimentos, HH, avanço e fechamento em paradas ou rotinas programadas."],
              ["Montagem eletromecânica", "Acompanhe frentes por disciplina, recurso, responsável, prioridade e status."],
              ["Obras industriais", "Organize curto prazo e tenha histórico confiável para reunião, medição e RDO."],
            ].map(([title, text]) => (
              <article className="audience-card" key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing" id="planos">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Planos</div>
            <h2>Comece grátis. Cresça sem mudar o fluxo.</h2>
            <p>
              Teste por 30 dias com as mesmas regras do plano Starter. Depois, escolha o plano
              ideal para manter dados, históricos, indicadores e RDOs.
            </p>
          </div>
          <div className="price-cards">
            {[
              {
                name: "Starter",
                price: "R$ 129",
                cta: "Começar grátis",
                features: [
                  "1 frente ativa",
                  "1 planejador",
                  "1 visitante",
                  "QR Code, turnos, atividades e RDO ilimitados",
                ],
              },
              {
                name: "Profissional",
                price: "R$ 249",
                cta: "Assinar Profissional",
                features: [
                  "3 frentes ativas",
                  "3 planejadores",
                  "3 visitantes",
                  "QR Code, turnos, atividades e RDO ilimitados",
                ],
              },
              {
                name: "Empresarial",
                price: "R$ 499",
                cta: "Assinar Empresarial",
                features: [
                  "Frentes ativas sem limite",
                  "Planejadores sem limite",
                  "Visitantes sem limite",
                  "Todos os recursos operacionais ilimitados",
                ],
              },
            ].map(({ name, price, cta, features }, index) => (
              <article className={`price ${index === 1 ? "featured" : ""}`} key={name}>
                <h3>{name}</h3>
                <div className="amount">{price} <small>/mês</small></div>
                <ul>
                  {features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link href="/cadastro" className={`btn ${index === 1 ? "btn-primary" : "btn-secondary"}`}>
                  {cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Dúvidas comuns</div>
            <h2>Para testar sem complicar a rotina.</h2>
          </div>
          <div className="faq-grid">
            {[
              ["O encarregado precisa ter conta?", "Não. O planejador acessa com login e publica o turno. O campo entra pelo QR Code."],
              ["Precisa instalar aplicativo?", "Não. A proposta é usar pelo navegador do celular."],
              ["Serve só para obra?", "Não. Serve para manutenção, montagem, paradas, fiscalização e contratos de campo."],
              ["O RDO sai automático?", "O RDO consolida informações do planejamento, campo, restrições e fechamento."],
              ["Posso acompanhar planejado x realizado?", "Sim. O Frentia mostra avanço, atividades, recursos, HH, PPC e restrições."],
              ["A tela Campo continua pública?", "Sim. Ela segue acessível pelo QR Code do turno, sem ser indexada por buscadores."],
            ].map(([question, answer]) => (
              <article className="faq" key={question}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>Saia do controle por mensagem e planilha.</h2>
          <p>
            Experimente o Frentia em uma frente real e acompanhe planejamento, campo,
            restrições, indicadores e RDO no mesmo fluxo.
          </p>
          <Link href="/cadastro" className="btn btn-primary">
            Começar grátis
          </Link>
        </div>
      </section>

      <footer>
        <div className="container footer-row">
          <div>Frentia</div>
          <div>Gestão de frentes, turnos, campo e RDO em tempo real.</div>
          <div className="footer-links">
            <Link href="/contato">Contato</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
