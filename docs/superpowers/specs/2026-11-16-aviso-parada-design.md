# Aviso de parada e "Terminei minha parte" — design (backlog item 6)

Data: 2026-11-16. Origem: teste do fluxo completo (João A1–A5, Ana 1, planejador B4/B5) em
`docs/testes/2026-11-16-fluxo-completo/`. Constrói sobre o item 4 (`docs/superpowers/specs/2026-11-16-efetivo-hh-design.md`).

## Intenção

Quando a equipe para no canteiro (peça não chegou, outra equipe não liberou), o responsável hoje não tem como avisar
pelo app: só existe o texto "Terminou? Avise o planejador." sem botão. Ele liga ou manda WhatsApp por fora, e o
registro não guarda a hora da parada nem a prova de que "minha equipe estava disponível". O planejador só descobre
depois, e o HH parado só entra se alguém lembrar de lançar "Parados" no fim do dia.

Queremos: o responsável avisa **na hora**, pelo link de campo, com causa em linguagem simples, quantas pessoas, desde
quando, observação e foto; o planejador fica sabendo na hora (WhatsApp + faixa no app/quadro/TV); quando voltam a
trabalhar, a parada é encerrada e vira HH parado no RDO. E o responsável consegue dizer "terminei minha parte".

## Objetivos

- Botão **"⚠ Avisar parada"** no link de campo (e na tela do turno do planejador) que registra uma parada **aberta**.
- Botão **"Voltamos a trabalhar"** que encerra a parada (grava o fim).
- Depois de registrar, botão **"Avisar no WhatsApp"** que abre o WhatsApp com a mensagem pronta para o planejador.
- Parada aberta aparece em destaque no topo da tela do turno, do quadro e da TV, com HH parado contando até agora.
- **Foto opcional** da parada, reduzida no celular; o aviso nunca espera a foto.
- Causas em linguagem simples ("Aguardando outra equipe" no lugar de "Atividade predecessora"), com a equipe aguardada
  quando a causa for essa, e marca interna/externa em cada causa.
- Botão **"Terminei minha parte"** no lugar do texto "Terminou? Avise o planejador.": marca a equipe como terminada
  (com hora) no quadro/TV e oferece o mesmo WhatsApp.

## Fora do escopo (não fazer agora)

- Notificação push no celular (o usuário escolheu WhatsApp; push pode vir se um piloto pedir).
- Envio automático de WhatsApp pelo servidor (API do WhatsApp Business): o botão só abre o app do usuário.
- Mudar a aparência do quadro além da faixa de paradas e do "✓ terminou" (o restante é o item 14).
- Separar interno/externo na Análise e no RDO por grupos (itens 14/18 — aqui só fica a marca pronta para eles).
- Vincular parada a uma atividade específica de outra equipe (só a equipe aguardada).
- Várias fotos por parada; foto em atividade ou no serviço extra (item 7).

## Anti-objetivos

- Não pode quebrar o cálculo de HH do item 4 nem o salvamento com sinal fraco (itens 1–3).
- O aviso nunca pode se perder ou ficar esperando por causa da foto ou do sinal ruim.
- Não pode mostrar "avisado" sem a parada estar gravada no servidor.
- Nada de `localStorage`/`sessionStorage` (regra do projeto) — foto pendente fica só na memória da página.
- Não pode estourar o limite de 4,5 MB de resposta do Vercel no PDF (RDO em lote).

## Abordagens consideradas (para a parada)

1. **Ampliar o "Parados" do item 4 (ESCOLHIDA)** — a parada é a mesma ocorrência `parado` de `efetivo_ocorrencias`;
   passa a aceitar `hora_fim` vazia (aberta) e ganha observação, equipe aguardada e foto. Um registro só por parada;
   RDO, quadro, resumo e HH parado já leem essa ocorrência. Custo: mexer na conta do HH recém-estável (há bons testes).
2. **Aviso separado que, ao encerrar, gera o "Parados"** — não toca no item 4, mas a mesma parada fica em dois lugares
   (podem divergir) e o HH parado não aparece no quadro enquanto aberta. Rejeitada.
3. **Só mensagem (sem registro)** — perde a prova e o HH parado. Rejeitada.

Como o planejador fica sabendo (decisão do usuário): **C) faixa no app + botão de WhatsApp**. Alternativas recusadas:
só no app (só vê quem estiver olhando) e notificação push (instalação obrigatória no iPhone, permissões, mais
trabalho e frágil em aparelhos de campo).

Foto (decisão do usuário): **já agora, opcional, nunca bloqueia o aviso**.

"Terminei minha parte" (decisão do usuário): **entra agora**, em registro simples separado.

## Tela do campo (`/t/[token]`, com responsável escolhido)

```
[⚠ Avisar parada]                          ← no topo, logo abaixo do horário, sempre visível

⚠ 2 Mecânico parados desde 10:40 · Aguardando outra equipe (Carlos)
  "rolamento 6312"   📷 foto enviada
  [Voltamos a trabalhar]  [Avisar no WhatsApp]

... atividades, efetivo, clima ...

[✓ Terminei minha parte]                   ← no lugar de "Terminou? Avise o planejador."
```

Formulário "Avisar parada" (curto, um passo):
- Quantos parados? (número, padrão = total da função escolhida) · Função (das linhas de efetivo da equipe, como no
  "Parados" do item 4; inclui as linhas recebidas por empréstimo, que valem para os emprestados).
- Por quê? (lista de causas com rótulo simples; se "Aguardando outra equipe" → escolher a equipe entre os
  responsáveis ativos da obra, exceto a própria; opcional "Outra / não sei").
- Desde (hora, padrão = agora no relógio do aparelho, arredondado ao minuto).
- Observação (opcional, até 500 caracteres).
- Foto (opcional): botão "📷 Tirar/escolher foto" (`<input type="file" accept="image/*" capture="environment">`).
- Botão "Registrar parada".

Depois de gravada no servidor: a parada aparece em destaque (formato acima) e o botão "Avisar no WhatsApp" fica
disponível nela (também depois de recarregar). Antes de confirmar, aparece "Registrando…" (selo cinza, padrão dos
itens 2–3), nunca "avisado".

"Voltamos a trabalhar": pergunta a hora (padrão agora) e grava o fim. Encerrada, a parada desce para a lista normal
de ocorrências do efetivo (formato do item 4: "2 parados 10:40–13:15 · Aguardando outra equipe (Carlos)") e o
WhatsApp oferece mensagem de retomada ("✅ Mecânicos do João voltaram às 13:15").

"✓ Terminei minha parte": grava a hora; o botão vira "✓ Você avisou que terminou às 15:20 · [Desfazer]" e oferece o
WhatsApp ("✓ João terminou a parte dele às 15:20"). Se houver parada aberta da equipe, pergunta antes se quer
encerrá-la no mesmo horário.

Sem responsável escolhido ("Ver tudo"): sem botões de parada/terminei (mantém a regra atual de que a pessoa lança
pela própria equipe); as paradas abertas aparecem só para leitura.

## Tela do planejador (turno)

- Faixa no topo do turno com as paradas abertas (mesmo texto) e, por equipe, "✓ terminou às HH:MM".
- O planejador também pode registrar parada por qualquer equipe e encerrá-la (mesmo componente; pela ocorrência
  `parado` do item 4, que já está em `OcorrenciasEfetivo`).
- A faixa se atualiza sozinha a cada 30 s **sem recarregar os formulários** da página (não pode perder o que o
  planejador está digitando) — ex.: componente cliente que consulta só as paradas/terminados.
- Fechar turno com parada aberta: a confirmação lista as paradas abertas, cada uma com o fim já preenchido com o
  fim do turno (real, senão previsto), editável; ao confirmar, grava os fins e fecha.
- "Enviar turno" pelo campo com parada aberta: permitido, com aviso "Há parada sem fim; o planejador vai encerrar".

## Quadro e TV

- Faixa vermelha no topo com cada parada aberta: "⚠ João · 2 Mecânico parados desde 10:40 (2h35) · Aguardando
  Carlos" — tamanho legível a 3 m na TV.
- HH parado da equipe conta a parada aberta **até agora** (limitado ao fim do turno); o quadro já se atualiza a cada 30 s.
- Na equipe que terminou: "✓ terminou 15:20".
- Foto não aparece no quadro (só no turno e no RDO).

## Mensagem do WhatsApp

- Link `https://wa.me/<número>?text=<mensagem>`; sem número cadastrado, `https://wa.me/?text=<mensagem>` (o usuário
  escolhe o contato).
- Número em `obras.whatsapp_planejador` (texto só com dígitos, com DDI; o formulário aceita "(11) 98888-7777" e
  completa 55 se vier sem DDI), editável na página da obra (mesmo lugar das janelas de intervalo).
- Texto (parada): `⚠ Parada — <obra> · <data/período>\n<responsável>: <N> <função> parados desde <HH:MM>\n
  Motivo: <causa>[ (<equipe aguardada>)]\n[<observação>]`. Sem link para o app na mensagem (o link do turno exige
  login; o planejador já tem o app). A foto não vai na mensagem (wa.me não anexa arquivo).
- Retomada e terminei: textos curtos equivalentes.

## Causas

- A mesma lista serve para atividades e paradas (`CAUSAS`, `lib/dominio/tipos.ts`); muda só o rótulo, os códigos
  ficam (dados antigos continuam válidos).
- Rótulos novos: `atividade_predecessora` → "Aguardando outra equipe"; `liberacao_area` → "Área não liberada /
  interferência"; `projeto_informacao` → "Falta projeto / informação"; `material` → "Falta material";
  `equipamento` → "Equipamento (falta ou quebra)"; `mao_de_obra` → "Falta de gente"; `clima`, `seguranca`, `outro`
  ficam. (Decisão de Claude; rótulos curtos para caber no celular.)
- Marca **externa** (fora do controle da equipe): material, projeto_informacao, clima, atividade_predecessora,
  liberacao_area, seguranca. **Interna**: mao_de_obra, equipamento. `outro`: sem marca. (Proposta de Claude, confirmada pelo
  usuário; usada agora só no aviso como etiqueta "externa", e pronta para os itens 14/18.)
- Equipe aguardada: só nas paradas (não nas atividades) neste item.

## Dados

- `efetivo_ocorrencias`:
  - `parado` passa a aceitar `hora_fim` nula (= aberta). Restrição `efetivo_ocorrencias_por_tipo` refeita.
  - `observacao text` (≤ 500, só parado), `aguardando_responsavel_id uuid` (só parado com causa
    `atividade_predecessora`; mesma obra — estender `tg_responsavel_mesma_obra`; `on delete set null`),
    `foto_path text` (caminho no Storage), `avisado_em timestamptz default now()`.
  - Encerrar = `update ... set hora_fim = $1 where id = $2 and hora_fim is null` (condicional: repetição e duas
    pessoas encerrando ao mesmo tempo não se anulam; a 2ª vê "já encerrada às HH:MM"). É a única edição permitida
    numa ocorrência; o resto continua criar/remover.
  - Validação: `hora_fim > hora_inicio` (respeitando noturno, como hoje) e dentro da janela do turno.
- `turno_equipes_terminadas` (nome livre): `turno_id` (cascade), `responsavel_id` (not null, mesma obra),
  `terminou_em time`, `created_at`; único por (turno, responsável); remover = desfazer; gatilho de turno fechado; RLS
  como `efetivo`.
- `obras.whatsapp_planejador text` (nulo = sem número).
- Storage: bucket **privado** `paradas`, caminho `<empresa>/<obra>/<turno>/<ocorrencia>.jpg`. Upload e leitura
  sempre pelo servidor (cliente admin escopado ao token no campo; sessão + checagem de membro no planejador); a tela
  mostra a foto por URL assinada de curta duração. Remover a ocorrência remove a foto (melhor esforço). Turno fechado:
  sem trocar/remover foto.
- Fotos/versões: `ocorrencias_json` inclui `observacao`, `aguardando_responsavel_id`, `foto_path`, `avisado_em`;
  `foto_checkin`/`foto_rdo`/`foto_semana` incluem os terminados. Versões antigas sem esses campos continuam lidas.

## Foto (envio)

- No aparelho: reduzir para no máx. 1280 px no lado maior, JPEG ~0,7 (alvo ≤ 300 KB) via `<canvas>` antes de enviar.
- Ordem: grava a parada (com id do cliente, como no item 4) → depois envia a foto para essa parada. Se a foto falhar,
  entra na repetição de `repeticao.ts` e no `rastreioSalvamento` ("Foto não enviada · tentar de novo"), com o
  `beforeunload` já existente avisando antes de sair. A foto pendente vive só na memória; recarregar a perde (o
  aviso de saída avisa).
- Limite no servidor: 2 MB, só `image/jpeg`/`image/png`/`image/webp` (reconvertidas no cliente para JPEG).
- Também dá para adicionar a foto depois, na parada já registrada (aberta ou encerrada), enquanto o turno estiver aberto.

## Cálculo (`lib/dominio/efetivoHH.ts`)

- `calcularHH` recebe um "agora" opcional. Parada aberta: vale até `agora` (limitado ao fim do turno) quando
  informado (quadro, faixa, resumo ao vivo); sem `agora` (RDO, versão oficial, fechamento), até o fim do turno.
- Hoje `parado` sem fim conta zero (`rel(o.hora_fim) ?? h1`) — trocar por esse comportamento; testes do item 4
  continuam passando.
- `descreverOcorrencia`: parada aberta → "2 parados desde 10:40 · Aguardando outra equipe (Carlos)"; encerrada como hoje,
  acrescentando a equipe aguardada.

## RDO

- Ocorrência parada mostra causa, equipe aguardada e observação ("2 Mecânico parados 10:40–13:15 — Aguardando outra
  equipe (Carlos) — rolamento 6312").
- RDO individual: as fotos das paradas em uma seção "Fotos das paradas" no fim (miniatura ~600 px, já reduzida).
- RDO em lote (PDF do mês): **sem fotos**, só "📷 foto no app" ao lado da parada — para não estourar 4,5 MB.
  (Decisão de Claude.)
- "Terminou às HH:MM" por equipe no RDO.

## Testes

- Unitários: parada aberta com/sem `agora`; limitada ao fim do turno; noturno; encerrar; descrição com equipe
  aguardada; montagem da mensagem do WhatsApp e do número (com/sem DDI, vazio); redução da foto (função pura do tamanho).
- Integração: criar parada aberta pelo token; encerrar condicional (duas vezes → 2ª recusa amigável); fim antes do
  início recusado; equipe aguardada de outra obra recusada; foto enviada/recusada (tamanho/tipo); turno fechado
  imutável (parada, foto, terminado); fechar turno grava fim das abertas; terminado único e desfazer; versão do RDO
  com os novos campos.
- E2E: João avisa parada pelo link → quadro mostra a faixa e HH parado crescendo → planejador vê no turno → João
  encerra → RDO mostra a parada com a equipe aguardada; "Terminei minha parte" aparece no quadro. Botão de WhatsApp:
  conferir só o `href`.

## Respostas à revisão do construtor (decisões de Claude, conferir)

- **Um formulário só de parada.** No campo e no turno, "⚠ Avisar parada" substitui o formulário "Parados" do item 4:
  mesmo formulário, com o campo opcional "Já voltaram às" (preenchido = parada registrada depois de encerrada, como
  no item 4; vazio = aberta). Observação, equipe aguardada e foto valem para os dois casos.
- **Várias paradas abertas ao mesmo tempo** são permitidas (uma por registro; ex.: 2 Mecânico e, depois, 3
  Caldeireiro). Faixa, "Voltamos a trabalhar" e WhatsApp funcionam **por parada**. Não há bloqueio de duas abertas na
  mesma função; o corte por quantidade do item 4 continua valendo (nunca conta mais gente do que a linha tem).
  "Terminei minha parte" com paradas abertas pergunta se encerra **todas** as abertas da equipe no mesmo horário.
- **Depois do fim previsto do turno.** Enquanto o horário real do fim não estiver preenchido, a validação aceita
  início/fim de parada **após o fim previsto** (até 23:59, ou até a manhã seguinte no noturno); o início continua
  tendo de ser ≥ início do turno. O HH continua limitado à janela do turno: quem fica além do previsto deve preencher
  o horário real (que já é a regra do HH). Ao fechar, o fim padrão das paradas abertas = fim do turno (real, senão
  previsto); se a parada começou depois disso, o fim padrão = início (HH parado 0) e a tela avisa.
- **Interna/externa** é uma constante no código (junto de `CAUSAS`), não configuração por empresa.

## Deixado para quem constrói

- Nomes exatos de arquivos/funções/tabela de terminados, layout fino, textos exatos.
- Mecanismo das server actions no padrão de `app/t/[token]/acoes.ts`, com `repeticao.ts` e `rastreioSalvamento`.
- Como a faixa do planejador se atualiza sem recarregar os formulários.
- Envio da foto por server action (FormData) ou rota `app/api/...` — o que funcionar melhor com o limite do Vercel.
