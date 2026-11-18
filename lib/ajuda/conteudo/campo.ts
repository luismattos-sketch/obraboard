import type { Capitulo } from "../tipos";

export const campo: Capitulo = {
  slug: "campo",
  titulo: "Como usar (responsável de campo)",
  resumo: "O que o responsável faz pelo link do turno, no celular.",
  noIndice: true,
  passos: [
    { id: "escolher-nome", titulo: "Escolha o seu nome", texto: [] },
    { id: "lancar", titulo: "Lance o que foi feito", texto: [] },
    { id: "efetivo", titulo: "Informe o efetivo", texto: [] },
    { id: "parada", titulo: "Registre uma parada", texto: [] },
    { id: "extra", titulo: "Serviço extra e adiantar", texto: [] },
    { id: "avisar", titulo: "Avise o planejador", texto: [] },
    { id: "sem-sinal", titulo: "Sem sinal", texto: [] },
  ],
};
