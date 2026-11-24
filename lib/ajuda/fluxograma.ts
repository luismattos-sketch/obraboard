// Fluxograma "Como o Frentia funciona": só o que o app faz hoje. Mudou a sequência? Edite esta lista.
import type { FaseFluxo } from "./tipos";

export const FLUXOGRAMA: FaseFluxo[] = [
  {
    titulo: "Uma vez por obra",
    linhas: [
      [
        { rotulo: "Criar a obra", ator: "planejador", href: "/ajuda/primeiros-passos#criar-obra" },
        { rotulo: "Cadastrar responsáveis", ator: "planejador", href: "/ajuda/primeiros-passos#responsaveis" },
        { rotulo: "Gerar link do quadro", detalhe: "para a TV", ator: "planejador", href: "/ajuda/primeiros-passos#link-quadro" },
      ],
    ],
  },
  {
    titulo: "Toda semana",
    linhas: [
      [
        {
          rotulo: "Programar a semana",
          detalhe: "meta, dias, equipe, responsável",
          ator: "planejador",
          href: "/ajuda/programar-semana#adicionar-atividade",
        },
        { rotulo: "\"Programar semana\"", detalhe: "sai do rascunho", ator: "planejador", href: "/ajuda/programar-semana#programar" },
      ],
    ],
  },
  {
    titulo: "Todo turno",
    linhas: [
      [
        { rotulo: "Novo turno", detalhe: "traz as atividades do dia", ator: "planejador", href: "/ajuda/check-in#novo-turno" },
        { rotulo: "Check-in", detalhe: "confirmar atividades e equipes", ator: "planejador", href: "/ajuda/check-in#efetivo" },
        { rotulo: "Liberar para campo", detalhe: "envia o link", ator: "planejador", href: "/ajuda/check-in#liberar" },
        { rotulo: "TV: check-in", ator: "tv", href: "/ajuda/quadro-tv#visoes" },
      ],
      [
        { rotulo: "\"Quem é você?\"", ator: "campo", href: "/ajuda/campo#escolher-nome" },
        { rotulo: "Iniciar turno", detalhe: "marca a hora de início", ator: "campo", href: "/ajuda/campo#iniciar" },
        { rotulo: "Lançar execução e efetivo", ator: "campo", href: "/ajuda/campo#lancar" },
        { rotulo: "Parada · serviço extra · adiantar", detalhe: "quando acontece", ator: "campo", href: "/ajuda/campo#parada" },
        { rotulo: "Terminei minha parte", detalhe: "todos terminaram = enviado", ator: "campo", href: "/ajuda/campo#avisar" },
      ],
      [
        { rotulo: "Check-out", detalhe: "confere, informa causas", ator: "planejador", href: "/ajuda/fechar-turno#check-out" },
        { rotulo: "Fechar o turno", ator: "planejador", href: "/ajuda/fechar-turno#fechar" },
        { rotulo: "RDO gerado", ator: "planejador", href: "/ajuda/fechar-turno#rdo" },
        { rotulo: "TV: check-out", ator: "tv", href: "/ajuda/quadro-tv#visoes" },
      ],
    ],
    nota: "Dá para criar o turno sem programar a semana; as atividades entram à mão.",
  },
  {
    titulo: "Fim da semana",
    linhas: [
      [
        { rotulo: "Encerrar a semana", detalhe: "causas do que não cumpriu", ator: "planejador", href: "/ajuda/encerrar-semana#encerrar" },
        { rotulo: "Análise (PPC)", detalhe: "% cumprido e causas", ator: "planejador", href: "/ajuda/encerrar-semana#analise" },
      ],
    ],
    nota: "Depois, volte para \"Programar a semana\" seguinte.",
  },
];
