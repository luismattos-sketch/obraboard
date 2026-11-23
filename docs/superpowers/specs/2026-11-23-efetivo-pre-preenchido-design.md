# Efetivo pré-preenchido (item 9 do teste)

## Por quê
O efetivo começa vazio e fica a ~1,5 tela do topo no link de campo; o responsável redigita a equipe que o
planejador já previu. A equipe prevista também não aparece no turno nem no quadro. [Ana, P1; caminho B decidido
pelo Luis em 2026-11-17]

## Objetivos
1. **Adicionar atividade** (planejador, no turno) ganha **Responsável** (obrigatório) e **Equipe** (função +
   quantidade, opcional, igual à programação). No link de campo, "Serviço extra" ganha **Equipe**; o responsável
   já é quem está lançando (como hoje).
2. Efetivo de cada responsável **começa com a equipe prevista**: soma das equipes das atividades dele no turno
   (programadas, via `programacao_efetivo`; avulsas, via tabela nova), agrupada por função.
3. Efetivo continua número próprio e ajustável; botões **−/+** na quantidade (luva).
4. No link de campo o bloco Efetivo sobe para logo depois do horário (antes das paradas e atividades).
5. Equipe prevista aparece na lista de atividades do turno (planejador e campo) e no card do quadro.

## Não-objetivos
- Aviso de equipe real menor que a soma (fica para depois, opcional).
- Mudar HH, ocorrências ou RDO: continuam sobre o efetivo **gravado**.

## Anti-objetivo
Gravar efetivo que ninguém confirmou. Registro imparcial: o previsto não vira real sozinho.

## Abordagens
- **A (escolhida — minha decisão):** previsto só na tela. Enquanto a equipe não tem efetivo gravado, o bloco
  mostra as linhas previstas marcadas "previsto pela programação — confirme ou ajuste" e um botão
  **Confirmar equipe**; qualquer ajuste (−/+, trocar função) também grava. Depois de gravado, o previsto não
  mexe mais no número. Atividade nova depois disso não altera o efetivo (só a etiqueta do previsto).
- B: copiar o previsto para `efetivo` ao criar/abrir o turno. Mais simples na tela, mas grava dado não
  confirmado e precisa recalcular quando entra atividade avulsa — descartada pelo anti-objetivo.
- C: efetivo calculado sempre pela soma. Descartada no caminho B (contaria em dobro).

## Como (decidido)
- Migração: tabela `atividade_equipe (id, atividade_id → atividades on delete cascade, funcao, quantidade > 0,
  created_at)`, RLS igual à de `efetivo`, imutável com turno fechado (mesmo gatilho), grants como as demais.
- Validação da equipe reaproveita a da programação (`FUNCAO_MAX`, `QTD_PESSOAS_MAX`, função obrigatória).
- Função pura `equipePrevista(atividades) → Map<responsavel_id, {funcao, quantidade}[]>` em `lib/dominio`, com
  teste; funções juntadas por `normalizarFuncao`/`canonizarFuncao`.
- `BlocoEfetivo` recebe `previsto?` e mostra o estado "previsto" quando `inicial` está vazio.
- Manual (`lib/ajuda/`: check-in, campo, durante-o-turno), capturas e uma linha em Novidades.

## Fica com quem constrói
Layout exato da etiqueta do previsto e da equipe nos cards; nomes internos; ordem dos commits.
