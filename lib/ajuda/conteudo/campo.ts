import type { Capitulo } from "../tipos";

export const campo: Capitulo = {
  slug: "campo",
  titulo: "Como usar (responsável de campo)",
  resumo: "O que o responsável faz pelo link do turno, no celular.",
  noIndice: true,
  passos: [
    {
      id: "escolher-nome",
      titulo: "Escolha o seu nome",
      texto: [
        "Abra o link que o planejador mandou. Em \"Quem é você?\", toque no seu nome: você vê e lança só as atividades e o efetivo da sua equipe. \"Ver tudo\" mostra o turno inteiro.",
        "Escolheu errado? Toque em \"Trocar\", no topo.",
      ],
      captura: {
        alt: "Tela Quem é você? com um botão por responsável e o botão Ver tudo",
        alvo: { papel: "heading", nome: "Quem é você?" },
        dispositivo: "celular",
      },
    },
    {
      id: "lancar",
      titulo: "Lance o que foi feito",
      texto: [
        "Em cada atividade, \"Total feito hoje\" é tudo o que a equipe fez no dia. Fez mais um trecho? Toque em \"+ Somar\" e digite só o que fez agora: o app mostra a conta (40 + 30 = 70) antes de somar.",
        "Terminou tudo? Toque em \"✓ Concluída\". Se já houver um número, o app pergunta antes de trocar (\"Trocar 40 por 60?\").",
        "Não precisa de botão de salvar: tudo salva sozinho. Espere aparecer \"Salvo ✓\".",
      ],
      captura: {
        alt: "Atividade no celular com o campo Total feito hoje e o selo Salvo",
        alvo: { papel: "textbox", nome: "Total feito hoje" },
        dispositivo: "celular",
      },
    },
    {
      id: "contar-dia",
      titulo: "Conte como foi o dia (IA)",
      texto: [
        "Prefere escrever do seu jeito? Em \"Conte como foi o dia\", escreva ou dite pelo microfone do teclado, por exemplo: \"fizemos 30 m de tubulação, faltou andaime\". Toque em \"Organizar\".",
        "A IA mostra o que entendeu e, se faltar algo, faz até 2 perguntas com botões (\"Andaime é… Falta material ou Equipamento?\"). O que você não falou fica como está, e nada é inventado.",
        "Nada é gravado até você tocar em \"Lançar\". Errou? Toque em \"Corrigir texto\". Sem sinal, o texto fica guardado: tente de novo ou lance nos cards.",
      ],
      dica: "O planejador vê o texto que você escreveu, junto do lançamento.",
      captura: {
        alt: "Caixa Conte como foi o dia com a prévia do que a IA entendeu e as perguntas com botões",
        alvo: { papel: "heading", nome: "Conte como foi o dia" },
        dispositivo: "celular",
      },
    },
    {
      id: "efetivo",
      titulo: "Informe o efetivo",
      texto: [
        "O \"Efetivo\" fica logo abaixo do horário. Se o planejador previu a equipe, ela já aparece preenchida: confira e toque em \"Confirmar equipe\", ou ajuste a quantidade com os botões − e + (o ajuste já grava).",
        "Enquanto você não confirma, a equipe prevista não conta no HH. Use \"+ Adicionar função\" se faltar alguma.",
        "Emprestou gente para outra equipe ou alguém saiu antes? Use \"+ Emprestar\" ou \"+ Saída antes\": assim o HH não conta em dobro.",
      ],
    },
    {
      id: "parada",
      titulo: "Registre uma parada",
      texto: [
        "A equipe parou? Toque em \"⚠ Avisar parada\". Diga \"Quantos parados\", a função, \"Por quê?\" (por exemplo, \"Aguardando outra equipe\" e qual equipe), \"Desde\" que horas e, se quiser, tire uma foto. Toque em \"Registrar parada\".",
        "O planejador vê o aviso na hora. Quando voltarem, toque em \"Voltamos a trabalhar\" e informe o horário.",
      ],
      captura: {
        alt: "Formulário de aviso de parada no celular",
        alvo: { papel: "button", nome: "Registrar parada" },
        dispositivo: "celular",
      },
    },
    {
      id: "extra",
      titulo: "Serviço extra e adiantar",
      texto: [
        "Fez algo que não estava programado? Toque em \"+ Serviço extra (fora da programação)\", descreva, informe a \"Quantidade feita\" e a \"Unidade\" e toque em \"Lançar serviço extra\".",
        "Vai começar uma atividade prevista para outro dia da semana? Toque em \"+ Adiantar atividade da semana\" e escolha a atividade. Para uma atividade de dia anterior que ficou pela metade, use \"Continuar atividade atrasada\".",
      ],
      captura: {
        alt: "Botões de serviço extra e de adiantar atividade no celular",
        alvo: { papel: "button", nome: "+ Serviço extra (fora da programação)" },
        dispositivo: "celular",
      },
    },
    {
      id: "avisar",
      titulo: "Avise o planejador",
      texto: [
        "Terminou a sua parte? Toque em \"✓ Terminei minha parte\". Se alguma atividade não chegou ao previsto, o app pede antes a \"Causa do não cumprimento\" (toque em \"ir\" para chegar ao campo). O planejador vê no quadro, e você pode avisar também pelo WhatsApp.",
        "Em \"Ver tudo\", quem fecha o turno inteiro pelo campo toca em \"Enviar turno\". Toda atividade programada que não chegou ao planejado precisa da \"Causa do não cumprimento\"; o app lista o que falta ao tocar em \"Enviar turno\". Serviço extra e atividade adiantada não pedem causa.",
      ],
      captura: {
        alt: "Botão Terminei minha parte no celular",
        alvo: { papel: "button", nome: "✓ Terminei minha parte" },
        dispositivo: "celular",
      },
    },
    {
      id: "sem-sinal",
      titulo: "Sem sinal",
      texto: [
        "Se aparecer \"Não salvo — sem sinal. Tentando de novo…\", continue com a tela aberta. O app reenvia sozinho quando o sinal volta. Não feche nem atualize a tela até o aviso sumir.",
      ],
    },
  ],
};
