import type { Capitulo } from "../tipos";

export const fecharTurno: Capitulo = {
  slug: "fechar-turno",
  titulo: "Fechar o turno e gerar o RDO",
  resumo: "Confira o que foi feito, informe as causas, feche o turno e baixe o RDO.",
  noIndice: false,
  passos: [
    { id: "check-out", titulo: "Confira a execução (check-out)", texto: [] },
    { id: "causas", titulo: "Informe as causas", texto: [] },
    { id: "fechar", titulo: "Feche o turno", texto: [] },
    { id: "rdo", titulo: "Baixe o RDO", texto: [] },
    { id: "reabrir", titulo: "Reabra um turno fechado", texto: [] },
  ],
};
