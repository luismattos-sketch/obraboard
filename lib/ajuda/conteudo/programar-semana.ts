import type { Capitulo } from "../tipos";

export const programarSemana: Capitulo = {
  slug: "programar-semana",
  titulo: "Programar a semana",
  resumo: "Olhe as próximas semanas no Lookahead e monte a programação da semana com meta, dias, equipe prevista e responsável de cada atividade.",
  noIndice: false,
  passos: [
    {
      id: "lookahead",
      titulo: "Olhe as próximas semanas no Lookahead",
      texto: [
        "Na etapa \"Lookahead\" do menu, veja o que vem nas próximas 3 a 6 semanas (escolha 3, 4, 5 ou 6 no topo). Cada semana lista os itens do cronograma cujo período cai nela; um item longo aparece em todas as semanas que cobre.",
        "Para trazer o cronograma da contratada, exporte do Project ou do Primavera em Excel (.xlsx) ou CSV e use \"Subir cronograma\". O Frentia adivinha as colunas (código/EDT, nome, início, término e, se houver, local, quantidade e unidade) e mostra uma prévia: quantos itens são novos, quantos mudaram, quantos saem do cronograma e quais linhas foram ignoradas.",
        "Quando o cronograma for revisado, suba o arquivo de novo: cada linha é reconhecida pelo código. O que mudou é atualizado, o que sumiu fica como \"Saiu do cronograma\" e nada que já foi levado para uma semana é apagado.",
        "Sem cronograma? Use \"Adicionar item\" e monte o lookahead à mão (descrição, início e término). Itens manuais podem ser editados e apagados; os importados seguem o arquivo.",
      ],
      captura: {
        alt: "Lookahead com as próximas semanas e os itens do cronograma em cada uma",
        alvo: { papel: "heading", nome: "Lookahead" },
        dispositivo: "computador",
      },
    },
    {
      id: "restricoes",
      titulo: "Marque as restrições de cada item",
      texto: [
        "No cartão do item, toque em \"Restrições\" e em \"Adicionar restrição\": escolha o tipo (material, área não liberada, segurança, falta de projeto…), descreva o que impede, informe o responsável por destravar (alguém da equipe ou do cliente) e, se quiser, o prazo.",
        "O item mostra quantas restrições estão abertas; se alguma passou do prazo, o selo fica vermelho com \"vencida\". Quando a trava for resolvida, toque em \"Removida\" — ela vai para \"Removidas\" e pode ser reaberta.",
        "Use a lista na reunião semanal: o objetivo é chegar à semana com o item sem restrição aberta.",
      ],
      captura: {
        alt: "Restrições de um item do lookahead com tipo, responsável e prazo",
        alvo: { papel: "heading", nome: "Restrições" },
        dispositivo: "computador",
      },
    },
    {
      id: "levar-lookahead",
      titulo: "Leve o item para a semana",
      texto: [
        "Em \"Levar para esta semana\", o Frentia abre a programação daquela semana (cria o rascunho se ainda não existe) com o formulário preenchido: descrição, local, unidade, dias do período e meta igual à quantidade do item. Ajuste a meta, o responsável e a equipe para o que cabe na semana.",
        "Para quebrar um item grande em partes, leve-o de novo e mude a descrição e a meta. No Lookahead, o item passa a mostrar \"Na semana de dd/mm\"; se o cronograma mudar depois, aparece \"Mudou desde que foi levado\" (a atividade da semana não muda sozinha).",
        "Semana já programada não recebe itens do lookahead.",
      ],
      captura: {
        alt: "Item do lookahead com o botão Levar para esta semana",
        alvo: { papel: "button", nome: "Levar para esta semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "abrir-programacao",
      titulo: "Abra a programação da semana",
      texto: [
        "No menu lateral, clique em \"Programação\". A lista mostra as semanas da obra, da mais recente para a mais antiga, com a situação de cada uma (Rascunho, Programada, Aguardando encerramento ou Encerrada) e o PPC.",
        "Enquanto a semana atual não tem programação (obra nova), o botão em destaque é \"Programar esta semana\"; depois, passa a ser \"Programar próxima semana\". Para outra semana, escolha uma data em \"Data da semana\" e clique em \"Abrir semana\": o app usa a segunda-feira daquela semana.",
      ],
      captura: {
        alt: "Lista de semanas da programação com os botões para abrir uma semana",
        alvo: { papel: "button", nome: "Abrir semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "adicionar-atividade",
      titulo: "Adicione as atividades",
      texto: [
        "A semana começa como rascunho. Em \"Nova atividade\", preencha a \"Descrição\", o \"Local (opcional)\", a \"Unidade\" e a \"Meta da semana\" (quanto deve ficar pronto até domingo).",
        "Marque os \"Dias\" em que a atividade vai ser feita e o \"Período\" (Diurno ou Noturno). O app divide a meta pelos dias e mostra a sugestão diária. Meta inteira (peças, tubos, un) é dividida em números inteiros, sem \"0,5 un\": o último dia fica com o que sobrar.",
        "Em \"Equipe prevista\", informe as funções e quantas pessoas de cada (\"Adicionar função\" para mais linhas). Escolha o \"Responsável\" pela atividade e clique em \"Adicionar atividade\".",
        "Depois de adicionar, o formulário limpa só a \"Descrição\" e a \"Meta da semana\": local, unidade, dias, período, responsável e equipe continuam preenchidos para a próxima atividade. Para repetir uma atividade parecida (ex.: a mesma no turno da noite), clique em \"Duplicar\" nela e troque só o que muda.",
      ],
      dica: "Atividade sem responsável não trava nada, mas o app avisa. Com responsável, cada um vê só a sua parte no link de campo.",
      captura: {
        alt: "Formulário de nova atividade da semana com meta, dias, período e equipe prevista",
        alvo: { papel: "button", nome: "Adicionar atividade" },
        dispositivo: "computador",
      },
    },
    {
      id: "trazer-semana-anterior",
      titulo: "Traga o que ficou da semana anterior",
      texto: [
        "No rascunho, o bloco \"Não concluídas da semana anterior\" lista as atividades da semana passada que ficaram com saldo, ex.: \"faltam 20 m² de 120 m²\". Clique em \"Trazer\": o formulário abre já preenchido, com a meta igual ao saldo. Ajuste os dias, o responsável e a meta se precisar e clique em \"Adicionar atividade\". Depois de trazida, a linha mostra \"Trazida ✓\".",
        "A semana anterior não muda: a atividade continua \"não cumprida\" no PPC dela, com a causa informada.",
        "Se a semana anterior ainda lançar execução depois que você trouxe (ex.: o turno de sábado), a atividade trazida mostra \"Saldo da semana anterior mudou: era 20 m², agora 12 m²\" e o botão \"Atualizar meta\". Nada muda sozinho: você decide. O botão vale também com a semana já programada, enquanto a atividade ainda não entrou em nenhum turno; depois disso, reabra a semana para mudar a meta.",
      ],
      dica: "Atividades em sequência (dia e noite) entram como um item só, com o saldo somado da sequência.",
      captura: {
        alt: "Bloco Não concluídas da semana anterior com o saldo e o botão Trazer",
        alvo: { papel: "button", nome: "Trazer" },
        dispositivo: "computador",
      },
    },
    {
      id: "continuar-proximo-turno",
      titulo: "Continue a atividade no próximo turno",
      texto: [
        "Quando o turno da noite continua o mesmo serviço do dia (ex.: o mesmo andaime), clique em \"Continuar no próximo turno\" na atividade. Atividade de um dia vai para o turno seguinte (dia → noite, noite → dia seguinte); de vários dias, vai para o outro período nos mesmos dias. Troque o responsável e a equipe e clique em \"Adicionar atividade\". Dá para encadear quantos turnos precisar.",
        "As atividades ligadas aparecem juntas na lista, com a meta total da sequência. O que faltar num turno passa para o seguinte: faltou 4 m no dia, a noite fica com meta 16 m; sobrou 3 m, a noite fica com 9 m. O último turno da sequência fica com todo o saldo.",
        "O turno que não cumpriu continua \"não cumprido\" e pede causa; o seguinte é medido pela meta herdada. No link de campo e no quadro aparece de onde veio a diferença, ex.: \"inclui 4 m do turno do dia (Luis)\".",
      ],
      dica: "O vínculo é opcional e só vale dentro da mesma semana. Sem vínculo, cada atividade segue a divisão normal da meta pelos dias.",
      captura: {
        alt: "Atividades do dia e da noite agrupadas como uma sequência, com o botão Continuar no próximo turno",
        alvo: { papel: "button", nome: "Continuar no próximo turno" },
        dispositivo: "computador",
      },
    },
    {
      id: "programar",
      titulo: "Programe a semana",
      texto: [
        "Confira a lista em \"Atividades da semana\" (\"Editar\" ou \"Apagar\" em cada uma) e clique em \"Programar semana\". O app pede confirmação, porque depois disso a lista, as metas e a equipe ficam travadas.",
        "A partir daí a semana fica Programada: cada turno novo daquela semana já vem com as atividades do dia e a quantidade sugerida.",
      ],
      captura: {
        alt: "Rascunho da semana com a lista de atividades e o botão Programar semana",
        alvo: { papel: "button", nome: "Programar semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "acompanhar",
      titulo: "Acompanhe a semana",
      texto: [
        "Com a semana programada, a mesma tela mostra o PPC da semana (provisório até encerrar) e, por atividade, a meta, o realizado, o saldo e a situação: Cumprida, Em andamento ou Sem execução.",
        "Também aparecem as atividades \"Fora da programação (extra)\" lançadas nos turnos e o quadro \"Efetivo previsto × real\" por dia, período e função.",
      ],
      captura: {
        alt: "Semana programada com PPC provisório, atividades e efetivo previsto × real",
        alvo: { papel: "heading", nome: "Efetivo previsto × real" },
        dispositivo: "computador",
      },
    },
    {
      id: "reabrir",
      titulo: "Reabra a programação",
      texto: [
        "Precisa mudar algo numa semana já programada? Clique em \"Reabrir programação\", informe o motivo e confirme. Edite as atividades e clique em \"Programar semana\" de novo.",
        "O que já foi lançado nos turnos continua ligado às atividades.",
      ],
    },
  ],
};
