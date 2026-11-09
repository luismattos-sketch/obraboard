import type { Metadata } from "next";
import { SeoPageContent, type SeoPageData } from "../seo-page-content";

export const metadata: Metadata = {
  title: "RDO digital com apontamento de campo | Frentia",
  description:
    "Use registros do turno, atividades, recursos e restrições para reduzir retrabalho na preparação do RDO digital.",
  alternates: { canonical: "https://www.frentia.com.br/rdo-digital" },
};

const data: SeoPageData = {
  h1: "Transforme registros do turno em informações para o RDO",
  intro:
    "O Frentia organiza a execução do dia para que o relatório diário de obra nasça de dados registrados no fluxo do turno.",
  pain:
    "O RDO costuma depender de memória, fotos soltas e mensagens enviadas depois da execução. Isso aumenta retrabalho e cria lacunas entre o que foi planejado, executado e justificado.",
  solution:
    "Ao registrar atividades, recursos, restrições e fechamento no Frentia, a equipe cria um histórico operacional que apoia a consolidação do RDO com menos digitação e mais rastreabilidade.",
  resources: [
    "Histórico por turno",
    "Atividades planejadas e executadas",
    "Restrições e tratativas",
    "Recursos mobilizados",
    "Resumo de fechamento",
  ],
  faqs: [
    {
      question: "O RDO usa dados do campo?",
      answer: "Sim. Os apontamentos do turno servem como base operacional para o relatório.",
    },
    {
      question: "Ajuda a reduzir retrabalho?",
      answer: "Sim. A informação registrada durante o turno diminui a reconstrução manual no fim do dia.",
    },
    {
      question: "Funciona para contratadas?",
      answer: "Sim. O histórico apoia prestação de contas, fiscalização e acompanhamento contratual.",
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
