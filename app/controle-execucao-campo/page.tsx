import type { Metadata } from "next";
import { SeoPageContent, type SeoPageData } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Controle de execução em campo | Frentia",
  description:
    "Controle atividades, recursos, restrições e avanço real da frente em campo sem depender de planilhas e mensagens soltas.",
  alternates: { canonical: "https://www.frentia.com.br/controle-execucao-campo" },
};

const data: SeoPageData = {
  h1: "Controle a execução em campo sem depender de planilhas e mensagens soltas",
  intro:
    "O Frentia conecta planejamento, QR Code de campo e painel para que a execução seja acompanhada durante o turno.",
  pain:
    "Em muitas obras e paradas, a informação nasce no campo por mensagem, foto ou planilha separada. Isso atrasa decisões, dificulta a priorização e deixa o planejador sem visão confiável do que está realmente acontecendo.",
  solution:
    "Com o Frentia, o planejador cria o turno, publica o acesso por QR Code e acompanha os apontamentos do encarregado no painel. Atividades, recursos e restrições ficam conectados ao mesmo turno.",
  resources: [
    "Publicação de turno por QR Code",
    "Apontamento de atividades pelo celular",
    "Registro de restrições em campo",
    "Painel de status em tempo real",
    "Histórico para checkout e RDO",
  ],
  faqs: [
    {
      question: "O encarregado precisa ter login?",
      answer: "Não. O acesso de campo acontece pelo link ou QR Code do turno publicado.",
    },
    {
      question: "O planejador continua com acesso protegido?",
      answer: "Sim. Planejamento, painel e cadastro continuam nos fluxos autenticados do aplicativo.",
    },
    {
      question: "Serve para obras e manutenção industrial?",
      answer: "Sim. O fluxo atende frentes de obra, montagem, manutenção e paradas industriais.",
    },
  ],
  related: [
    { label: "Planejado x realizado", href: "/planejado-vs-realizado" },
    { label: "Controle de turno", href: "/controle-turno-obra" },
    { label: "Gestão de restrições", href: "/gestao-restricoes-obra" },
  ],
};

export default function Page() {
  return <SeoPageContent data={data} />;
}
