# Teste de usabilidade: planejador, fase 1 (manhã de 16/11/2026)

Persona: planejador de uma empreiteira de manutenção industrial, primeiro uso, no notebook (1366×768). Também testei o celular (390 px) e uma TV (1920×1080).
Servidor: http://127.0.0.1:3000 (build de produção, Supabase de DEV). Specs: `specs/10-planejador-1..4-*.spec.ts`. Log bruto: `notas/planejador-log.jsonl`. Capturas: `shots/planejador-*.png`.

## Resultado geral
O fluxo inteiro funcionou sem nenhum bloqueio: criar a obra → cadastrar 4 responsáveis → programar 8 atividades → criar o turno → liberar o campo → gerar o link público. Não houve erro de console nem `pageerror`. Os únicos avisos foram um "preload not used" do logo e alguns prefetch abortados (`ERR_ABORTED`) durante a navegação, que não afetam nada. Não houve scroll horizontal em 390 px em nenhuma tela.

## Tempos (ação → resposta visível)
| Ação | Tempo |
|---|---|
| Login | 1,0–2,6 s |
| Criar obra | 2,4 s |
| Salvar responsável (cada) | 1,4–1,9 s |
| Abrir tela Programação | 0,8 s |
| Abrir semana atual (cria o rascunho) | 1,8 s |
| Adicionar atividade (cada, 8 vezes) | 1,4–2,4 s (média ≈ 1,7 s) |
| Programar semana | 1,4 s |
| Abrir "Novo turno" | 0,9 s |
| Criar turno | **3,3 s** (a mais lenta) |
| Abrir quadro pelo turno | 1,3 s |
| Liberar para campo | 2,6 s |
| Gerar link público do quadro | 0,9 s |
| Quadro público (TV, sem login) | 1,6 s |
| Celular: abrir obra / semana / turno / quadro | 0,8 / 1,0 / 1,5 / 1,2 s |

## Cliques e telas por tarefa (aproximado)
- **Criar obra:** 2 telas (lista → formulário) e 1 clique em "Nova obra" + 3 campos + "Criar obra".
- **4 responsáveis:** abrir a seção recolhida "Responsáveis (0)" (1 clique), depois 3 ações por pessoa (+ Novo, digitar, Salvar). São 13 cliques em 1 tela.
- **Programar a semana (8 atividades):** Programação → Abrir semana (2 cliques). Cada atividade levou ≈ 9–11 interações: 4 campos, 1 a 3 dias, o responsável, 1 ou 2 funções com quantidade e "Adicionar". No total foram cerca de 85 interações e ~22 s no robô. Para uma pessoa, conto de 8 a 12 minutos.
- **Turno + liberar + links:** obra → Novo turno → Criar → Liberar → copiar o link; depois voltar para a obra → Gerar link → Copiar. São 4 telas e 7 cliques.

---

## Achados

### A1. Os links (campo e TV) somem ao recarregar a página — **atrapalha (quase bloqueia)**
- **Onde:** página do turno (`/turnos/[id]`), painel "Link de campo", e a página da obra, card "Link do quadro (TV / gestor)".
- **O que aconteceu:** depois de "Liberar para campo", o link aparece uma única vez, com o aviso "Guarde este link: ele não será exibido de novo". Dei F5 e ele sumiu. Ficou só "Link enviado. Perdeu o link? Gere um novo (o anterior deixa de funcionar)". O card do quadro público tem o mesmo comportamento.
- **Por que é grave:** é comum o planejador dar F5, trocar de aba ou fechar o notebook antes de mandar o link para os 4 responsáveis. Se ele gerar um link novo, o link já enviado no grupo do WhatsApp e o da TV deixam de funcionar sem nenhum aviso.
- **Evidência:** `shots/planejador-24-turno-liberado-link.png` (com o link) e `planejador-25-turno-liberado-apos-reload.png` (sem o link); no log, `linkVisivel: 0` depois do reload. Celular: `planejador-41-cel-obra.png` ("Link já gerado. Perdeu o link?").
- **Sugestão:** mostrar o link sempre enquanto o turno estiver aberto (só para o planejador logado). Se o motivo for segurança, ao menos manter o botão "Copiar" ativo e deixar "Gerar novo link" com uma confirmação explícita, por exemplo "o link que está na TV vai parar de funcionar".

### A2. Atividade de 1 unidade dividida em "0,5 un" por dia — **atrapalha**
- **Onde:** turno e quadro. Exemplo: "Revisão geral da bomba B-301", meta 1 un em Seg/Ter, vira "0,5 un" no turno de hoje.
- **O que aconteceu:** a meta da semana é dividida igualmente entre os dias marcados. Para serviços discretos de manutenção (revisar 1 bomba, 1 alinhamento), "0,5 un" não faz sentido em campo. O quadro da TV mostra "0 / 0,5 un".
- **Evidência:** `planejador-22-turno-criado.png`, `planejador-23-quadro-checkin-antes-liberar.png`, `planejador-28-quadro-publico-tv.png`.
- **Sugestão:** para metas inteiras pequenas (ou unidade "un"), não fracionar: concentrar no último dia ou usar "em andamento". Outra opção é deixar o planejador ajustar a meta de cada dia no rascunho.

### A3. Logo de manhã o turno já aparece cheio de alertas vermelhos de "causa" — **atrapalha**
- **Onde:** página do turno, logo depois de "Liberar para campo".
- **O que aconteceu:** às 7h, com nada executado, cada atividade mostra em vermelho "Informe a causa para atividades não concluídas". No fim da página aparece uma caixa amarela "Falta informar a causa em:" com as 7 atividades, e "Fechar turno" já está disponível. A página tem cerca de 6.250 px de altura em 1366 px de largura.
- **Evidência:** `planejador-24-turno-liberado-link.png`.
- **Sugestão:** cobrar a causa só ao tentar fechar o turno, ou depois do horário previsto de fim. Enquanto o turno está em campo, recolher "Corrigir execução" num bloco fechado, para o planejador ver primeiro o link e o resumo.

### A4. O quadro da TV abre em "CHECK-OUT" com 0% e barras vermelhas logo de manhã — **atrapalha**
- **Onde:** link público `/q/...` em 1920×1080 (e o quadro interno em `/quadro`).
- **O que aconteceu:** logo depois da liberação, a TV já mostra "CHECK-OUT", "0 de 2 programadas · 0%", barras com um traço vermelho e "0 pessoas" para todos. De manhã, o que a equipe quer ver na TV é o combinado do dia (o check-in). O vermelho passa a ideia de atraso antes de o trabalho começar.
- **Evidência:** `planejador-28-quadro-publico-tv.png`, em comparação com `planejador-23-quadro-checkin-antes-liberar.png`.
- **Sugestão:** mostrar o check-in até uma hora configurável (ex.: metade do turno) ou até haver o primeiro lançamento, e não usar vermelho com 0% enquanto o turno não passou da metade. Acrescentar a hora da última atualização, porque numa TV não dá para saber se a tela travou.

### A5. A equipe prevista na programação não chega ao turno nem ao quadro — **atrapalha**
- **Onde:** turno (seção "Efetivo") e quadro ("Efetivo não informado" / "0 pessoas").
- **O que aconteceu:** cadastrei, por exemplo, 4 Caldeireiro + 2 Soldador para Ana. No turno, a seção Efetivo de cada responsável vem vazia ("+ Adicionar função"), e o quadro mostra "Efetivo não informado". A programação calculou "Efetivo previsto: Seg 24", mas esse número não aparece em nenhum lugar do dia.
- **Evidência:** `planejador-14-semana-programada.png` (previsto 24), `planejador-22-turno-criado.png` e `planejador-23-...png`.
- **Sugestão:** pré-preencher o efetivo do turno com o previsto, como sugestão a confirmar, e mostrar "previsto 6 · real –" no quadro de check-in.

### A6. "Programar semana" trava a semana sem pedir confirmação — **atrapalha**
- **Onde:** rascunho da semana.
- **O que aconteceu:** o botão laranja grande fica logo abaixo de "Adicionar atividade" (`planejador-12-...png`). Um clique trava lista, metas e equipe sem nenhuma confirmação; nenhum `dialog` aparece no log. Existe "Reabrir programação", mas o planejador não sabe disso na hora e pode se assustar.
- **Sugestão:** pedir confirmação com um resumo ("8 atividades, 4 responsáveis, efetivo de segunda 24 — programar?") e afastar o botão do formulário.

### A7. Depois de criar a obra, o app não indica o próximo passo — **atrapalha**
- **Onde:** página da obra recém-criada (`planejador-03-obra-criada.png`).
- **O que aconteceu:** o menu destaca "2. Turnos", e o texto diz "Nenhum turno ainda. Crie o primeiro para planejar as atividades." Só que, pelo método do app, o planejamento é feito na "1. Programação". O botão de destaque é "Novo turno". A seção Responsáveis vem recolhida e não aparece como passo do roteiro.
- **Sugestão:** mostrar na obra nova um checklist: 1) cadastre os responsáveis, 2) programe a semana, 3) crie o turno de hoje. Abrir os Responsáveis quando a lista estiver vazia.

### A8. Na Programação, o botão principal leva para a próxima semana, não para a atual — **atrapalha**
- **Onde:** `/programacao` (`planejador-10-programacao-vazia.png`).
- **O que aconteceu:** o botão laranja de destaque é "Programar próxima semana". Para programar a semana atual (o caso de hoje), é preciso usar o botão secundário "Abrir semana" ao lado do campo de data. Num primeiro uso, na segunda-feira de manhã, é fácil cair na semana errada. O campo de data também apareceu como 11/16/2026 (formato americano). Isso pode ser só deste ambiente, mas vale verificar num Chrome em pt-BR.
- **Sugestão:** quando a semana atual ainda não tiver programação, o destaque deve ser "Programar esta semana (16/11 a 22/11)".

### A9. Depois de "Programar semana", nenhum botão leva ao turno de hoje — **detalhe**
- **Onde:** semana programada (`planejador-14-semana-programada.png`): "Seg 16/11 · Diurno — previsto 24 · sem turno".
- **Sugestão:** transformar "sem turno" num link "Criar turno de hoje", ou criar o turno do dia automaticamente ao programar. Hoje o planejador volta para a obra e abre "Novo turno"; o formulário dele só repete data e horário, que já vêm certos (data de hoje, 07:00–17:00). Esse é um passo que daria para automatizar.

### A10. Responsável sem campo de especialidade ou frente; texto usa "encarregado" — **detalhe**
- **Onde:** seção Responsáveis da obra (`planejador-06-responsaveis-cadastrados.png`).
- **O que aconteceu:** só há Nome e Telefone. Não tem onde registrar "caldeiraria", "elétrica" etc., que é como o planejador de manutenção organiza as equipes. O texto de ajuda diz "Quem assume as atividades no turno: encarregado, líder, supervisor…", e o produto definiu não usar "encarregado".
- **Sugestão:** um campo opcional "Frente/especialidade", mostrado no quadro e no "Quem é você?". Trocar o texto de ajuda.

### A11. Formulário da atividade é longo e não aproveita a repetição — **detalhe**
- **Onde:** rascunho da semana (`planejador-12-...png`, `planejador-13-...png`).
- **O que aconteceu:** a cada atividade nova, o formulário zera tudo: responsável volta para "Sem responsável", dias e equipe também zeram. Programei 2 atividades seguidas do mesmo responsável e com a mesma equipe, e precisei refazer tudo. O formulário fica no fim da lista, então quanto mais atividades, mais a página desce (o scroll foi de 494 para 1605 px). Não existe "duplicar atividade".
- **Sugestão:** manter o responsável e os dias da última atividade, criar o botão "Duplicar" e oferecer um modo tabela para lançar várias atividades de uma vez (ou colar do Excel). Esse último é o maior ganho de tempo para uma parada geral.

### A12. Textos e formatação — **detalhe**
- Plural ausente: "2 Soldador", "4 Caldeireiro", "8 motor", "≈ 8 tubo/dia".
- A ordem das funções se inverte: cadastrei "4 Caldeireiro + 2 Soldador" e a tela mostra "2 Soldador + 4 Caldeireiro".
- Na grade da semana, o ícone ☀ (diurno) é tão pequeno que parece um asterisco "✱", sem legenda.
- Na grade, a semana vai até "Sáb" e a coluna Dom não aparece. Paradas costumam trabalhar no domingo.
- Na página do turno, cada atividade tem um botão vermelho "Remover" cheio e setas ↑ ↓ sem rótulo. Com 7 atividades, a página fica visualmente "perigosa" e o risco de remover por engano é alto.
- "Trazer da programação" continua visível depois de as atividades já terem vindo, e não está claro o que acontece se clicar de novo.
- Horário do novo turno em "07:00 AM / 05:00 PM" (formato 12 h). Pode ser deste ambiente; vale conferir em pt-BR.

### A13. Celular (390 px) — **detalhe / ok**
- Sem scroll horizontal em obra, semana, turno, quadro e novo turno. Os botões têm bom tamanho e o quadro empilha bem (`planejador-45-cel-quadro.png`).
- A página do turno fica muito longa no celular. Programar 8 atividades pelo celular é possível, mas cansativo (veja A11).
- O "Quem é você?" do link de campo está claro e com botões grandes (`planejador-29-link-campo-quem-e-voce.png`).

### A14. Quadro na TV — **detalhe**
- Em 1920 px, nomes e números ficam em fonte de ~20 px, pequena para ler a 3–4 m. Sobra metade da tela vazia com 4 responsáveis.
- Não há relógio nem "atualizado às hh:mm".
- **Sugestão:** um modo TV com fonte maior e que ocupe a altura da tela.

## O que funcionou bem
- O turno de hoje nasceu automaticamente com as 7 atividades do dia, agrupadas por responsável. A pintura (Qui/Sex) ficou de fora, como deveria.
- O formulário de novo turno já vem com a data de hoje e o horário padrão.
- A prévia "≈ 8 tubo/dia" ajuda a conferir a meta.
- A grade semanal com as barras dá uma boa visão geral da semana.
- O botão "Enviar pelo WhatsApp" já monta o texto com obra, data e link.
