import type { Metadata } from "next";
import { SeoPageContent, type SeoPageData } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Software para gestão de paradas industriais | Frentia",
  description:
    "Controle frentes de serviço em paradas industriais com turnos, QR Code de campo, restrições e planejado x realizado.",
  alternates: {
    canonical: "https://www.frentia.com.br/software-gestao-paradas-industriais",
  },
};

const data: SeoPageData = {
  h1: "Controle frentes de serviço durante paradas industriais",
  intro:
    "Acompanhe atividades críticas, recursos, restrições e avanço real durante janelas curtas de execução.",
  pain:
    "Paradas industriais concentram muitas frentes, equipes e restrições em pouco tempo. Sem informação em tempo real, pequenos desvios se acumulam e ficam visíveis apenas quando a janela já está pressionada.",
  solution:
    "O Frentia organiza a execução por obra e turno, libera acesso de campo por QR Code e mostra no painel o que avançou, o que travou e o que precisa de decisão.",
  resources: [
    "Controle de frentes por turno",
    "Apontamento simples para encarregados",
    "Restrições visíveis durante a parada",
    "Planejado x realizado em tempo real",
    "Histórico para fechamento e RDO",
  ],
  faqs: [
    {
      question: "Serve para manutenção industrial?",
      answer: "Sim. O Frentia atende rotinas de manutenção, montagem e paradas programadas.",
    },
    {
      question: "A equipe precisa instalar aplicativo?",
      answer: "Não. O campo acessa pelo navegador do celular usando o QR Code publicado.",
    },
    {
      question: "Ajuda em janelas curtas de parada?",
      answer: "Sim. A visibilidade em tempo real ajuda a priorizar decisões durante a execução.",
    },
  ],
  related: [
    { label: "Controle de execução em campo", href: "/controle-execucao-campo" },
    { label: "Planejado x realizado", href: "/planejado-vs-realizado" },
    { label: "Gestão de restrições", href: "/gestao-restricoes-obra" },
  ],
};

export default function Page() {
  return <SeoPageContent data={data} />;
}
