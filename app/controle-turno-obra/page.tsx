import type { Metadata } from "next";
import { SeoPageContent, type SeoPageData } from "../seo-page-content";

export const metadata: Metadata = {
  title: "Controle de turno de obra em tempo real | Frentia",
  description:
    "Acompanhe início, avanço, restrições e encerramento do turno de obra em um fluxo conectado ao campo.",
  alternates: { canonical: "https://www.frentia.com.br/controle-turno-obra" },
};

const data: SeoPageData = {
  h1: "Acompanhe início, avanço, restrições e encerramento do turno",
  intro:
    "Controle cada turno com informações de planejamento, campo e fechamento em uma rotina única.",
  pain:
    "Sem controle claro de turno, a equipe perde o momento em que a atividade começou, onde travou e o que ficou pendente. O fechamento passa a depender de relatos e conferências demoradas.",
  solution:
    "O Frentia estrutura o turno desde o check-in: atividades, recursos, responsáveis, QR Code de campo, acompanhamento no painel e checkout com histórico do que ocorreu.",
  resources: [
    "Check-in operacional",
    "Publicação do turno ativo",
    "Acompanhamento de tempo e status",
    "Checkout com pendências",
    "Base para indicadores e RDO",
  ],
  faqs: [
    {
      question: "Dá para usar por turno de produção?",
      answer: "Sim. O fluxo foi pensado para rotinas por turno em obras, manutenção e paradas.",
    },
    {
      question: "O campo informa início e finalização?",
      answer: "Sim. O encarregado registra o andamento pela tela Campo.",
    },
    {
      question: "O fechamento fica registrado?",
      answer: "Sim. O checkout consolida informações do turno para acompanhamento posterior.",
    },
  ],
  related: [
    { label: "Controle de execução em campo", href: "/controle-execucao-campo" },
    { label: "Planejado x realizado", href: "/planejado-vs-realizado" },
    { label: "RDO digital", href: "/rdo-digital" },
  ],
};

export default function Page() {
  return <SeoPageContent data={data} />;
}
