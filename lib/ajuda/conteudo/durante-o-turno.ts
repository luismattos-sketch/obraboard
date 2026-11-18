import type { Capitulo } from "../tipos";

export const duranteOTurno: Capitulo = {
  slug: "durante-o-turno",
  titulo: "Acompanhar o turno",
  resumo: "Veja o andamento no quadro, as paradas avisadas pelo campo e lance serviço extra ou atividade adiantada.",
  noIndice: false,
  passos: [
    { id: "quadro", titulo: "Acompanhe pelo quadro", texto: [] },
    { id: "paradas", titulo: "Veja as paradas avisadas", texto: [] },
    { id: "servico-extra", titulo: "Lance um serviço extra", texto: [] },
    { id: "adiantar", titulo: "Adiante uma atividade", texto: [] },
  ],
};
