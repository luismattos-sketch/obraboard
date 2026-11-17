# Serviço extra e adiantar atividade — design

Backlog item 7 (docs/backlog.md). Origem: teste de 2026-11-16 (Carlos, Rita, planejador fase 2 —
docs/testes/2026-11-16-fluxo-completo/).

## Por quê

No teste de fluxo completo:
- O Carlos fez 12 luminárias da plataforma 3 (serviço fora da programação) e não tinha onde lançar pelo link de
  campo. As horas sumiram no quadro e o registro do extra — que mais tarde vira prova para pleito — se perdeu.
- A Rita quis adiantar a pintura programada para quinta/sexta e não havia como puxá-la para hoje.
- O planejador só conseguiu lançar o extra pelo "Adicionar atividade", escondido em "Editar planejamento", sem
  responsável, sem executado e sem marca de extra. A atividade nasceu "não iniciada", travou o fechamento ("Há
  atividades sem causa informada") e derrubou o cumprimento do dia (63%, 5 de 8).
- Em atividade concluída a Observação some (some da tela e é gravada como nula).

Sucesso: o que foi feito no campo fica registrado no mesmo dia, por quem fez, marcado como extra ou adiantada,
sem travar o fechamento e sem distorcer os números.

## Objetivos
1. Pelo link de campo (/t/[token]), o responsável escolhido em "Quem é você?" pode:
   - **Adiantar atividade da semana**: escolher uma atividade programada da semana **atribuída a ele** que ainda
     tenha saldo e não esteja no turno de hoje; ela entra no turno de hoje.
   - **Lançar serviço extra (fora da programação)**: descrição, quantidade executada, unidade, observação
     opcional, foto opcional.
2. No turno do planejador: botão visível "+ Serviço extra (fora da programação)" (fora de "Editar
   planejamento"), com responsável, descrição, quantidade executada, unidade, observação e foto opcionais; e
   "+ Adiantar atividade da semana" e "Continuar atividade atrasada" (mesmas regras do campo, mas de qualquer
   responsável).
3. O que o campo lança **entra direto** (sem aprovação), com a marca "lançado pelo campo"; o planejador pode
   corrigir ou remover até fechar o turno (regras de edição de sempre).
4. Extra e adiantada aparecem com selo ("Extra", "Adiantada") no turno, no link de campo, no quadro/TV e no RDO
   (PDF e versão oficial).
5. Extra e adiantada **ficam fora do cumprimento do dia** (turno, RDO e quadro) e aparecem como "+N extra" /
   "+N adiantada", como o quadro já faz com extras. A adiantada conta normalmente no PPC da semana (soma no
   realizado da atividade programada).
6. Observação continua visível e gravada em atividade concluída (qualquer atividade, não só extra).

## Não-objetivos
- Aprovação do planejador / fila de pendentes (decidido: entra direto).
- Ciência do fiscal, dossiê de pleito em PDF (roadmap item 4 — este item só registra; o registro serve de base).
- Responsável adiantar atividade de outra equipe (decidido: só as dele; ajuda entre equipes = empréstimo de
  efetivo ou extra).
- Resto do item 13 (rótulos "Cumprimento do dia" × "PPC da semana", ⓘ) e do item 17 (RDO por responsável).
- Notificação push.

## Anti-objetivos
- Extra ou adiantada travando o fechamento por falta de causa.
- Extra ou adiantada baixando a porcentagem do dia.
- Lançamento duplicado com sinal fraco (reenvio cria dois extras).
- Foto obrigatória travando o responsável sem sinal.

## Restrições
- Sem `localStorage`/`sessionStorage` (AGENTS.md). Supabase é a fonte.
- Next.js da versão do repo: ler `node_modules/next/dist/docs/` antes de mexer em rotas/ações.
- Migration aplicada à mão pelo SQL Editor (DEV e PROD), sem CLI.
- Termo "Responsável", nunca "encarregado".
- Gravação do campo segue o padrão já existente: repetição (lib repeticao.ts, rastreioSalvamento), selo cinza até
  confirmar, id gerado no cliente para reenvio idempotente (como efetivo_ocorrencias).
- Atualizar o Vercel ao concluir.

## Abordagens consideradas
1. **Marca gravada na atividade** (escolhida pelo usuário): colunas novas em `atividades`; RDO, quadro e semana
   leem a marca. Funciona em obra com ou sem programação semanal.
2. Tudo deduzido, sem migration (extra = sem ligação com a programação): quebra em obra sem programação semanal
   (toda atividade pareceria extra) e não tem onde guardar a foto. Descartada.
3. Tabela separada de extras: duplicaria cartão, gravação, conflito, RDO e quadro. Descartada.

**Ajuste dentro da abordagem 1 (minha decisão, a confirmar):** no diálogo propus "adiantada" deduzida (ligada à
programação num dia não programado). Gravo a marca também para a adiantada — a dedução quebraria se o planejador
mudasse os dias da programação depois, e o gatilho de fechamento precisa saber, no banco, que ela não exige causa.

## Design

### Banco (uma migration)
- `atividades.tipo text null check (tipo in ('extra','adiantada'))` — null = atividade normal do dia.
  - `adiantada` exige `programacao_atividade_id` não nulo; `extra` exige nulo (check).
- `atividades.criada_por_id uuid references responsaveis(id) on delete set null` — preenchido quando criada pelo
  link de campo ("lançado pelo campo"). Entra na checagem de mesma obra (tg_responsavel_mesma_obra).
- `atividades.foto_path text null` — foto opcional (só extra). Bucket privado, só servidor, URL assinada, mesma
  validação de bytes JPEG de lib/db/fotosParada.ts (generalizar o utilitário; bucket/pasta: decisão do builder).
- Gatilho de causa pendente (`tg_turno_causa_pendente`): ignora atividades com `tipo` não nulo.
- Funções de foto (`foto_rdo`, `foto_checkin`, `foto_semana`, última versão em 20261118000000_aviso_parada.sql):
  incluir `tipo` e `criada_por_id` no JSON das atividades. Fotos antigas sem o campo = atividade normal.
- Extras na semana (`DadosSemana.turnos[].extras`, minha decisão): regra **não muda** — continua "sem ligação
  com a programação" (inclui `tipo='extra'`). Sem backfill de registros antigos; nenhum UPDATE na migration.

### Quantidades (minha decisão)
- **Extra**: não tem meta. Nasce com `qtd_planejada = qtd_realizada = quantidade informada` (> 0). Corrigir a
  quantidade executada atualiza as duas. Sempre "concluída"; não pede causa.
- **Adiantada**: nasce com `qtd_planejada` = saldo da semana da atividade programada (meta − realizado em outros
  turnos), `qtd_realizada` vazia; o responsável lança o executado no cartão normal. Não pede causa ao fechar
  (gatilho acima) e fica fora do cumprimento do dia. O realizado soma no PPC da semana pelo mecanismo existente
  (`realizadoAte`), e a sugestão dos dias seguintes já cai pelo saldo (`sugestaoDoDia`).
- Unicidade existente (turno_id + programacao_atividade_id) impede adiantar a mesma atividade duas vezes no turno.
- Saldo (minha decisão): meta − executado em **todos** os outros turnos da semana, qualquer status (igual a
  `sugestaoDoDia`/`trazerDaProgramacao`).
- Cópias futuras (minha decisão): quando uma adiantada recebe execução, turnos futuros da semana ainda em
  `planejado` que tenham cópia dessa atividade sem execução têm `qtd_planejada` recalculada pela sugestão do dia
  (`sugestaoDoDia` com o novo realizado); se a sugestão der nula, a cópia é removida. Turnos já em campo ou além
  não são tocados.

### Link de campo (/t/[token])
Abaixo das atividades do responsável:
```
[ + Adiantar atividade da semana ]
[ + Serviço extra (fora da programação) ]
```
- Os dois botões aparecem só com um responsável escolhido e turno editável pelo campo (mesmas regras de status
  de hoje). Em "Ver tudo", sem botões.
- Adiantar: lista "Pintura — Qui/Sex — saldo 40 m²" das atividades da semana programada com
  `responsavel_id` = ele, saldo > 0, mesmo período do turno, ainda não no turno, e **com algum dia programado
  depois de hoje e nenhum dia programado até hoje** (só futuras; decidido pelo usuário). Sem semana programada
  ou lista vazia: texto "Nenhuma atividade sua para adiantar nesta semana. Fale com o planejador."
- **Continuar atividade atrasada** (decidido pelo usuário): terceiro botão, só quando houver atividade dele na
  semana com algum dia programado **antes de hoje**, saldo > 0 e ainda não no turno. Entra como atividade
  **normal** do dia (`tipo` nulo, ligada à programação, `qtd_planejada` = saldo): conta no cumprimento do dia e
  pede causa se não terminar — o atraso continua aparecendo. Atividade que tem dias antes e depois de hoje
  entra aqui (não em adiantar). O planejador também tem esse botão (qualquer responsável).
- "Quem é você?" (minha decisão): além de quem já tem atividade/efetivo no turno, lista os responsáveis com
  atividade programada na semana (mesmo período). Sem isso, a Rita sem nada hoje nem consegue se escolher.
- Extra: formulário curto (descrição, quantidade, unidade, observação, foto). Responsável = ele,
  criada_por_id = ele.
- Depois de gravar, o cartão aparece na lista dele com o selo e "lançado por você". Oferecer o link do WhatsApp
  do planejador (mesmo mecanismo wa.me da parada, `obras.whatsapp_planejador`) com texto pronto — opcional.
- O responsável pode remover o que ele mesmo criou enquanto o turno estiver editável pelo campo.

### Turno do planejador
- "+ Serviço extra (fora da programação)" e "+ Adiantar atividade da semana" visíveis perto da lista de
  atividades, fora do bloco "Editar planejamento".
- Cartões com selo "Extra"/"Adiantada" e "lançado pelo campo — <nome>" quando `criada_por_id` existir.
- Editar/remover pelos caminhos existentes.

### Números
- Cumprimento do turno e do RDO (`percentualCumprimento` via resumirTurno): conta só `tipo` nulo; mostrar
  "+N extra · +N adiantada" ao lado.
- Quadro (`resumoEquipe`): base = todas as atividades com `tipo` nulo (minha decisão: inclui as que o planejador
  adicionou à mão, como já fazem turno e RDO); extras e adiantadas contadas à parte ("+N extra · +N adiantada").
  Hoje "extras" no quadro = não programadas; passa a usar a marca, e as três telas passam a bater.
- "Adicionar atividade" do planejador continua como está (atividade normal do dia).
- PPC da semana: sem mudança de regra.
- Análise de PPC por turno (lib/dominio/analise.ts): excluir atividades com `tipo` não nulo do denominador
  (coerente com o cumprimento do dia).

### Observação em atividade concluída
- BlocoAtividades.tsx hoje grava `observacao` só se não concluída e esconde o campo; passar a mostrar e gravar
  sempre.

### Testes
- Domínio (vitest): cumprimento sem extra/adiantada; quadro com marca; saldo para adiantar; lista de adiantáveis.
- Integração (SUPABASE_TEST=1): criar extra/adiantada pelo campo (inclusive reenvio idempotente e responsável de
  outra obra recusado); fechamento não exige causa; checks de tipo; foto.
- E2E: Carlos lança extra no celular e aparece no quadro e no turno; Rita adianta pintura e o PPC da semana soma.

## Fica para o builder
- Nome/forma das funções e ações, componentes, onde o formulário abre (folha, expansível, página).
- Bucket/pasta da foto do extra e como generalizar fotosParada.ts.
- Texto exato do WhatsApp.
- Como o RDO em PDF exibe o selo (coluna, prefixo).
