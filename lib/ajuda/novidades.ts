// Novidades do app, da mais recente para a mais antiga. Toda funcionalidade nova ganha uma linha aqui.
import type { Novidade } from "./tipos";

export const NOVIDADES: Novidade[] = [
  {
    data: "2026-11-26",
    texto: "Página do turno mais curta: \"Fechar turno\" fica no alto, ao lado de \"Ver quadro\", e a lista do que falta para fechar aparece ali mesmo. A página abre com o que serve para acompanhar (paradas, o que falta e resumo); \"Corrigir execução\", RDO, link de campo e histórico ficam recolhidos, a um toque. O \"Remover\" da atividade ficou discreto.",
    href: "/ajuda/fechar-turno#fechar",
  },
  {
    data: "2026-11-26",
    texto: "Quadro único: abre só pelo link, sem login, e o check-in e o check-out acontecem no mesmo quadro. O selo na barra azul troca sozinho para \"CHECK-OUT\" quando a primeira equipe inicia. E o quadro ganhou o resumo do clima, com a previsão antes do turno.",
    href: "/ajuda/quadro-tv#visoes",
  },
  {
    data: "2026-11-25",
    texto: "Clima automático: o RDO registra sozinho o tempo durante o turno (leitura de 2 em 2 horas, média, máxima, mínima e chuva), pela cidade da obra. Ninguém precisa mais lançar o clima.",
    href: "/ajuda/fechar-turno#clima",
  },
  {
    data: "2026-11-25",
    texto: "Quadro mais legível na TV: de manhã abre no check-in, quem precisa de ajuda vem primeiro, causa externa e interna em cores diferentes e letra maior, observação, selo \"acima da meta\", empréstimo nos dois lados e hora da última atualização.",
    href: "/ajuda/quadro-tv#visoes",
  },
  {
    data: "2026-11-25",
    texto: "Análise (PPC) mais fiel: começa na semana em que a obra começou, mostra \"provisório\" no PPC do período enquanto há semana em andamento e separa as causas em externas, internas e outras.",
    href: "/ajuda/encerrar-semana#analise",
  },
  {
    data: "2026-11-25",
    texto: "O quadro agora só exibe: \"Problemas e oportunidades\" se cadastram, resolvem e apagam na página do turno.",
    href: "/ajuda/quadro-tv#problemas",
  },
  {
    data: "2026-11-25",
    texto: "Números mais claros: o turno e o RDO mostram \"Cumprimento do dia\" com o avanço físico ao lado, e a semana mostra o avanço físico junto do PPC, cada um com uma explicação curta (ⓘ).",
    href: "/ajuda/encerrar-semana#numeros-diferentes",
  },
  {
    data: "2026-11-24",
    texto: "Resumo do turno no topo do quadro: anel com as concluídas, \"Tempo do turno\" × \"Avanço do dia\" com aviso \"abaixo do ritmo\" e a aderência da obra. O gráfico dia a dia mudou para a Análise (PPC).",
    href: "/ajuda/quadro-tv#resumo-turno",
  },
  {
    data: "2026-11-24",
    texto: "Quadro com \"Problemas e oportunidades\": anote o problema, a ação, quem cuida e o prazo; os abertos aparecem no quadro e na TV.",
    href: "/ajuda/quadro-tv#problemas",
  },
  {
    data: "2026-11-24",
    texto: "O que ficou com saldo na semana anterior aparece no rascunho da semana seguinte: \"Trazer\" já preenche a atividade com a meta igual ao saldo. Se a semana anterior ainda lançar depois, o app avisa e oferece \"Atualizar meta\".",
    href: "/ajuda/programar-semana#trazer-semana-anterior",
  },
  {
    data: "2026-11-24",
    texto: "Check-in mais simples: a equipe se ajusta no \"Editar\" de cada atividade e o botão \"Confirmar\" confirma a atividade e a equipe dela, que já entra no efetivo do responsável. Saiu o quadro \"Efetivo\" separado.",
    href: "/ajuda/check-in#efetivo",
  },
  {
    data: "2026-11-24",
    texto: "Atividades em sequência: \"Continuar no próximo turno\" liga a atividade do dia à da noite (ou ao dia seguinte) e o que faltar ou sobrar num turno passa para a meta do próximo.",
    href: "/ajuda/programar-semana#continuar-proximo-turno",
  },
  {
    data: "2026-11-23",
    texto: "Botão \"Iniciar turno\" no link de campo: o horário real do turno sai sozinho do primeiro início e do último \"Terminei minha parte\". O clima voltou a ser lançado pelo responsável no celular.",
    href: "/ajuda/campo#iniciar",
  },
  {
    data: "2026-11-23",
    texto: "Programação mais rápida: o formulário mantém local, dias, período, responsável e equipe entre uma atividade e outra, botão \"Duplicar\", confirmação antes de programar e especialidade no responsável.",
    href: "/ajuda/programar-semana#adicionar-atividade",
  },
  {
    data: "2026-11-23",
    texto: "Link de campo mais fácil: reabrir o link no mesmo celular já entra com o seu nome, botão \"Trocar\" maior, aviso de sem sinal em destaque, metas inteiras para peças e mensagens em português.",
    href: "/ajuda/campo#escolher-nome",
  },
  {
    data: "2026-11-23",
    texto: "No link de campo, cada um lança só o que é seu: confirmação do nome, \"Ver tudo\" só para olhar, horário e clima com o planejador e envio automático quando todos terminam.",
    href: "/ajuda/campo#escolher-nome",
  },
  {
    data: "2026-11-23",
    texto: "O efetivo já vem com a equipe prevista: confirme ou ajuste com − e +.",
    href: "/ajuda/campo#efetivo",
  },
  {
    data: "2026-11-23",
    texto: "O que falta: no turno, veja por responsável o que ainda não foi registrado e cobre pelo WhatsApp com um toque.",
    href: "/ajuda/durante-o-turno#o-que-falta",
  },
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
