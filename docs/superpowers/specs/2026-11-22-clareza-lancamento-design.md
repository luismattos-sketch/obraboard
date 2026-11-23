# Item 11 — Clareza do lançamento

Data: 2026-11-22 · Branch: `clareza-lancamento` · Tamanho: mudança pequena (sem migration)

## Por quê

Teste de 2026-11-16 (Carlos): "✓ Concluída" trocou 40 por 60 sem aviso (lançou produção que não houve);
"Executado" substitui em vez de somar (quem lança só o trecho da tarde derruba o total); não fica claro que salva
sozinho. É o card que a IA vai preencher ("fizemos mais 30" = somar).

## Decidido com o Luis

1. **Campo = total do dia**, rótulo `Total feito hoje (<unidade>)`, com botão `+ Somar` ao lado: abre
   `Quanto a mais?` + prévia `40 + 30 = 70` + `Somar` / `Cancelar`. Somar grava o total pelo caminho de salvar atual.
2. **"✓ Concluída" com parcial** (valor > 0 e abaixo da meta) vira, no card, `Trocar 40 por 60?` com `Sim` / `Não`.
   Campo vazio ou 0: marca direto, como hoje.

## Abordagens

Um caminho só: tudo no card (`BlocoAtividades`), contas em funções puras, mesmo salvar. Lançamentos separados
(linhas no banco) foram descartados: mexem em banco, RDO e quadro sem ganho para este problema.

## Minhas decisões (conferir)

- Serviço extra: mesmo rótulo e `+ Somar`; continua sem "Concluída".
- Texto `salva sozinho` pequeno junto do campo enquanto o indicador está ocioso; some quando aparece "Salvando…"/"Salvo ✓".
- Somar: total vazio vale 0; aceita vírgula; quantidade vazia, zero, negativa ou texto → `Digite um número válido`, sem
  gravar. Total atual inválido → `Corrija o total antes de somar`.
- "Não" fecha a pergunta sem mudar nada; editar o campo também fecha.
- Planejador usa o mesmo card. Somente leitura: sem `+ Somar`, sem pergunta.
- Mesmo PR: manual (campo, fechar-turno: "Executado" → "Total feito hoje", explicar Somar e a pergunta), capturas,
  Novidades; E2E que usam `/Executado/`.
