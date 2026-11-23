// Novidades do app, da mais recente para a mais antiga. Toda funcionalidade nova ganha uma linha aqui.
import type { Novidade } from "./tipos";

export const NOVIDADES: Novidade[] = [
  {
    data: "2026-11-22",
    texto: "Conte como foi o dia: no link de campo, escreva ou dite e a IA organiza o lançamento para você conferir antes de gravar.",
    href: "/ajuda/campo#contar-dia",
  },
  {
    data: "2026-11-22",
    texto: "Lançamento mais claro: \"Total feito hoje\", botão \"+ Somar\" e pergunta antes de trocar um parcial pela meta.",
    href: "/ajuda/campo#lancar",
  },
  {
    data: "2026-11-22",
    texto: "A causa só é pedida no fim: ao tocar \"Terminei minha parte\", enviar ou fechar o turno.",
    href: "/ajuda/fechar-turno#causas",
  },
  { data: "2026-11-18", texto: "Manual do usuário: esta Ajuda, com o passo a passo de cada tarefa.", href: "/ajuda" },
  {
    data: "2026-11-17",
    texto: "Serviço extra e adiantar atividade, pelo campo e pelo planejador.",
    href: "/ajuda/durante-o-turno#servico-extra",
  },
  {
    data: "2026-11-17",
    texto: "Aviso de parada: o responsável avisa na hora, com causa, gente parada e foto.",
    href: "/ajuda/durante-o-turno#paradas",
  },
  {
    data: "2026-11-16",
    texto: "Links de campo e da TV continuam visíveis e pedem confirmação antes de gerar um novo.",
    href: "/ajuda/check-in#enviar-link",
  },
  {
    data: "2026-11-16",
    texto: "Efetivo e HH corretos: empréstimo entre equipes, gente parada e desconto do intervalo.",
    href: "/ajuda/check-in#efetivo",
  },
  {
    data: "2026-11-16",
    texto: "Sinal fraco: o que não salvou fica marcado e é reenviado quando a rede volta.",
    href: "/ajuda/duvidas#nao-salvo",
  },
  {
    data: "2026-11-16",
    texto: "Mais de uma aba aberta: o app avisa o conflito em vez de desfazer o que foi gravado.",
    href: "/ajuda/duvidas#conflito-abas",
  },
];
