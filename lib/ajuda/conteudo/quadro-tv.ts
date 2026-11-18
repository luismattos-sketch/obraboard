import type { Capitulo } from "../tipos";

export const quadroTv: Capitulo = {
  slug: "quadro-tv",
  titulo: "Quadro na TV",
  resumo: "Deixe o quadro do turno numa TV do canteiro, sem login, e troque o link quando precisar.",
  noIndice: false,
  passos: [
    { id: "link", titulo: "Abra o quadro na TV", texto: [] },
    { id: "visoes", titulo: "Check-in e check-out no quadro", texto: [] },
    { id: "trocar-link", titulo: "Troque o link do quadro", texto: [] },
  ],
};
