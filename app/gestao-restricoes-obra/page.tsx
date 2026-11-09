import type { Metadata } from "next";
import { SeoPageContent, type SeoPageData } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Gestão de restrições de obra | Frentia",
  description:
    "Registre restrições no turno, acompanhe impactos e trate impedimentos antes que eles virem atraso de obra.",
  alternates: { canonical: "https://www.frentia.com.br/gestao-restricoes-obra" },
};

const data: SeoPageData = {
  h1: "Registre restrições durante o turno antes que elas virem atraso",
  intro:
    "Capture impedimentos no momento em que aparecem e mantenha planejamento e coordenação olhando para o mesmo dado.",
  pain:
    "Restrições registradas tarde viram justificativas depois do atraso. Quando ficam em mensagens soltas, é difícil saber impacto, responsável, status e prioridade de tratamento.",
  solution:
    "No Frentia, o campo registra restrições associadas ao turno e às atividades. O painel dá visibilidade para decisões durante a execução e para o fechamento do dia.",
  resources: [
    "Registro de restrição pelo celular",
    "Status de restrições abertas",
    "Vínculo com atividade e turno",
    "Visibilidade no painel",
    "Histórico para checkout e RDO",
  ],
  faqs: [
    {
      question: "A restrição aparece para o planejador?",
      answer: "Sim. O apontamento de campo alimenta o acompanhamento do turno.",
    },
    {
      question: "Pode registrar impedimento parcial?",
      answer: "Sim. A equipe pode registrar restrições durante a execução para orientar decisões.",
    },
    {
      question: "Ajuda no RDO?",
      answer: "Sim. As restrições registradas compõem o histórico operacional do turno.",
    },
  ],
  related: [
    { label: "Controle de turno", href: "/controle-turno-obra" },
    { label: "Planejado x realizado", href: "/planejado-vs-realizado" },
    { label: "RDO digital", href: "/rdo-digital" },
  ],
};

export default function Page() {
  return <SeoPageContent data={data} />;
}
