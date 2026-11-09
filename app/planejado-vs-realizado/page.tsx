import type { Metadata } from "next";
import { SeoPageContent, type SeoPageData } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Planejado x realizado em obras e paradas industriais | Frentia",
  description:
    "Compare planejado x realizado em tempo real e acompanhe avanço, recursos, restrições e produtividade do turno.",
  alternates: { canonical: "https://www.frentia.com.br/planejado-vs-realizado" },
};

const data: SeoPageData = {
  h1: "Veja em tempo real o que foi planejado e o que realmente foi executado",
  intro:
    "Transforme o acompanhamento do turno em dados visíveis para planejamento, coordenação e fiscalização.",
  pain:
    "Quando o realizado só aparece no fim do dia, atrasos e desvios deixam de ser tratados no momento certo. A equipe perde tempo reconciliando versões de planilhas, mensagens e relatos.",
  solution:
    "O Frentia mostra o avanço do turno enquanto o campo aponta as atividades. O painel consolida status, recursos, restrições e execução para comparar plano e realidade sem esperar o fechamento.",
  resources: [
    "Avanço real das atividades",
    "Status de tarefas por turno",
    "Recursos previstos x realizados",
    "Restrições abertas e tratadas",
    "Indicadores para fechamento do turno",
  ],
  faqs: [
    {
      question: "O painel atualiza durante o turno?",
      answer: "Sim. Os apontamentos feitos na tela Campo alimentam a visão do painel.",
    },
    {
      question: "É possível acompanhar atividades parciais?",
      answer: "Sim. O fluxo permite registrar avanço e status antes da finalização completa.",
    },
    {
      question: "Isso substitui a rotina de reunião diária?",
      answer: "Ele apoia a reunião com dados mais confiáveis e reduz a preparação manual.",
    },
  ],
  related: [
    { label: "Controle de execução em campo", href: "/controle-execucao-campo" },
    { label: "RDO digital", href: "/rdo-digital" },
    { label: "Paradas industriais", href: "/software-gestao-paradas-industriais" },
  ],
};

export default function Page() {
  return <SeoPageContent data={data} />;
}
