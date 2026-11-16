# Conflito entre abas na execução — desenho curto

Backlog item 1 (Prioridade 1 — Confiança no dado). Origem: teste da Rita, R1 e R2
([docs/testes/2026-11-16-fluxo-completo/rita.md](../../testes/2026-11-16-fluxo-completo/rita.md)).

## Por quê
Uma aba esquecida (o mesmo link aberto no WhatsApp e no Chrome, ou a tela do planejador) regrava a
quantidade, a causa e a observação que tinha na tela e desfaz em silêncio a correção feita em outro lugar.
O número do campo deixa de ser confiável. O efetivo já tem proteção, mas a mensagem fala em "outra pessoa"
(muitas vezes é a própria pessoa) e não dá saída: recarregar apaga o que foi digitado.

## Objetivos
- Nenhuma gravação da execução sobrescreve um valor que a tela não viu, no campo (link) e no planejador.
- O conflito aparece igual na execução e no efetivo: texto claro e botão **"Ver valor atual"**.
- Uma aba que volta a ficar visível se atualiza sozinha quando não tem edição pendente.

## Fora do escopo
- Rede fraca, fila de reenvio, "não salvo" visível (item 2) e "Salvo ✓" enganoso (item 3).
- Histórico de quem alterou e permissões do "Ver tudo" (item 10).
- Opção "Manter o meu" no conflito (decidido: não oferecer).

## Abordagens consideradas
1. **Conferir os três valores (escolhida).** A tela manda o `esperado` (quantidade, causa e observação como
   estão no banco, do jeito que ela viu ou gravou por último). O UPDATE só grava se os três ainda forem iguais.
   É o mesmo princípio do efetivo e não gera alarme falso quando o planejador muda só a descrição.
2. Número de versão por atividade: robusto, mas pede migração e dá alarme falso em qualquer edição da atividade.
3. Gravar só o campo alterado: não protege duas abas editando a quantidade, e ainda precisaria da 1.

## Desenho
**Servidor** (`salvarExecucao` em `lib/db/campo.ts` e `salvarExecucaoPlanejador` em `lib/db/execucao.ts`):
- Novo parâmetro `esperado: { qtd_realizada, causa, observacao }`, validado como os dados.
- O UPDATE ganha os filtros do esperado (`eq`, ou `is null` quando o valor é nulo), num único comando atômico.
- Se nenhuma linha for gravada: relê a atividade. Se ela não existe ou não é da equipe, continua
  "Atividade não encontrada". Se existe, é **conflito**: devolve a mensagem de conflito e os valores atuais.
- Em caso de sucesso, devolve os valores **como gravados** (observação aparada, causa/observação nulas quando
  concluída), para a tela usar como próximo `esperado`.
- Para isso, `Resultado` ganha um campo opcional de detalhe na falha (ou um tipo específico para o conflito);
  a forma fica com quem constrói.

**Tela** (`components/execucao/BlocoAtividades.tsx`):
- Cada atividade guarda o `esperado` (começa com os valores do servidor) e salva em série (`criarFila`, como o
  efetivo), para que um salvamento lento não gere conflito falso no seguinte.
- Conflito mostra (tom de alerta, não de erro grave):
  "Mudou em outra tela (pode ter sido você em outra aba). Agora está **46 m**, você tinha digitado **47**."
  e o botão **"Ver valor atual"**, que carrega os valores do servidor naquele bloco. Depois de carregar, fica a
  nota "Você tinha digitado 47" até a próxima edição. Se a causa ou a observação divergirem, a frase cita o que
  mudou.
- Não grava de novo sozinho depois do conflito.

**Efetivo** (`BlocoEfetivo.tsx` e `ERRO_EFETIVO_CONFLITO`):
- Texto: "O efetivo mudou em outra tela (pode ter sido você em outra aba)." mais o mesmo botão "Ver valor atual".
  Depois de carregar: "Você tinha digitado: Pedreiro 7, Servente 2".

**Voltar para a aba:** ao ficar visível (`visibilitychange`), a página do campo e a do turno do planejador
chamam `router.refresh()` se não houver salvamento em andamento (`useRastreioSalvamento`). O `Sincronizar`
já troca os valores dos blocos sem edição pendente.

## Testes
- Integração (`tests/integracao/campo.test.ts` e `execucao.test.ts`): esperado velho → conflito e banco intacto;
  esperado certo → grava; mexer só na observação com quantidade velha → conflito (caso exato da Rita);
  equipe errada continua "não encontrada"; nulos no esperado.
- Componente: conflito mostra os valores e "Ver valor atual" recarrega o bloco; salvamentos em série.
- E2E: duas páginas no mesmo link reproduzindo o roteiro R1.

## Fica com quem constrói
Formato exato do detalhe do conflito no `Resultado`; como o `Sincronizar` força a remontagem de um bloco em
conflito (hoje ele não remonta com edição pendente); comparação numérica de `qtd_realizada` (numeric × número JS).
