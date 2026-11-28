import type { Capitulo } from "../tipos";

export const metodoLps: Capitulo = {
  slug: "metodo-lps",
  titulo: "O método LPS no Frentia",
  resumo: "O que é o Last Planner, o ciclo da semana e como o Roteiro da semana e a Pauta da reunião conduzem cada passo.",
  noIndice: false,
  passos: [
    {
      id: "o-que-e",
      titulo: "O que é o LPS",
      texto: [
        "O Last Planner System (LPS) é um jeito de planejar a obra em que quem faz o trabalho se compromete só com o que pode cumprir. Em vez de empurrar o cronograma, a equipe olha à frente, remove o que impede a execução e assume um compromisso semanal realista.",
        "O resultado é medido pelo PPC (percentual do programado concluído): quanto do compromisso da semana foi cumprido. As causas do que não foi cumprido mostram o que atacar para a semana seguinte ser melhor.",
      ],
    },
    {
      id: "ciclo",
      titulo: "O ciclo da semana",
      texto: [
        "1. Olhar 3 a 6 semanas à frente (Lookahead) e marcar as restrições de cada item. 2. Remover as restrições a tempo. 3. Programar a semana só com o que está livre. 4. Executar com check-in e check-out em cada turno. 5. Encerrar a semana com o PPC e as causas. 6. Aprender e recomeçar.",
        "Na página da obra, o \"Roteiro da semana\" mostra em que ponto do ciclo você está: ✓ feito, ○ pendente e ! pede atenção. Cada passo tem um botão para a tela certa e um \"Por que isso?\".",
      ],
      captura: {
        alt: "Roteiro da semana na página da obra com os passos do ciclo",
        alvo: { papel: "heading", nome: "Roteiro da semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "encerrar",
      titulo: "Encerrar a semana passada",
      texto: [
        "Fechar a semana com a causa de cada atividade não cumprida é o que gera o aprendizado. Sem causa, o PPC vira só um número; com causa, mostra se o problema foi material, liberação de área, projeto ou a própria equipe.",
      ],
    },
    {
      id: "lookahead",
      titulo: "Olhar o Lookahead e remover restrições",
      texto: [
        "O Lookahead mostra o que vem nas próximas semanas. Em cada item, registre as restrições (o que impede a execução) e quem tem de destravar. O objetivo é que o item chegue à semana sem restrição aberta; restrição vencida aparece em vermelho no roteiro.",
      ],
    },
    {
      id: "programar",
      titulo: "Programar a próxima semana",
      texto: [
        "O compromisso da semana só deve ter o que está livre e cabe na equipe. Se uma atividade entra com restrição aberta, o Frentia pede o motivo e marca \"Entrou com restrição\"; a Análise mostra depois se isso compensou.",
      ],
    },
    {
      id: "turno",
      titulo: "Turno de hoje: check-in e check-out",
      texto: [
        "No check-in, cada equipe confirma o que vai fazer no turno. No check-out, registra o que fez e a causa do que não fez. É esse registro diário que alimenta o PPC da semana.",
      ],
    },
    {
      id: "reuniao",
      titulo: "Conduzir a reunião semanal com a pauta",
      texto: [
        "Em \"Abrir pauta da reunião\", o Frentia junta numa página: o PPC e as causas da semana passada, as restrições abertas por responsável (vencidas primeiro), o Lookahead das próximas 3 semanas e a situação da próxima semana. Projete na TV ou use \"Imprimir\".",
        "Uma ordem que funciona: 1) o que aconteceu e por quê (causas); 2) quem destrava o quê e até quando (restrições); 3) o que vem (Lookahead); 4) o compromisso da próxima semana (Programação).",
      ],
      captura: {
        alt: "Pauta da reunião com a semana passada, as restrições por responsável e o lookahead",
        alvo: { papel: "heading", nome: "Pauta da reunião" },
        dispositivo: "computador",
      },
    },
  ],
};
