# Efetivo e HH corretos — design (backlog item 4)

Data: 2026-11-16. Origem: teste do fluxo completo (Rita R3, João A3, planejador B3/B4) em
`docs/testes/2026-11-16-fluxo-completo/`.

## Intenção

O efetivo e o HH do turno vão para o RDO, que é prova perante o cliente. Hoje eles mentem em três situações comuns
de canteiro:

1. **Empréstimo entre equipes** — a Rita emprestou 2 montadores para a Ana à tarde; as duas lançaram, e o RDO mostrou
   19 pessoas / 190 HH quando havia 17 pessoas.
2. **Pessoa parada** — o João lançou "Mecânico parado aguardando peça" via "Outra função…", que virou HH produtivo e
   sujou a lista de funções.
3. **Almoço** — HH = pessoas × (fim − início), sem descontar o intervalo.

Também falta **meio período** (gente que sai antes do fim do turno).

## Objetivos

- Contar cada pessoa uma vez só (na equipe de origem), mesmo emprestada.
- HH por equipe = horas efetivamente trabalhadas naquela equipe, descontando o intervalo da obra.
- Separar **HH produtivo** de **HH parado** (com causa), no resumo do turno, no quadro e no RDO.
- Registrar tudo pelo link de campo (responsável) e pela tela do turno (planejador), com a mesma aparência.

## Fora do escopo (não fazer agora)

- Aviso de parada em tempo real, foto, notificação ao planejador (backlog item 6 — reaproveitará esta base).
- HH parado na Análise (PPC); separar causa interna × externa (itens 14/18).
- Efetivo pré-preenchido com a programação (item 9).
- Registro por pessoa nominal (nomes, crachás).

## Anti-objetivos

- Não pode quebrar o salvamento do efetivo nem a proteção de conflito entre abas recém-estabilizados (itens 1–3).
- Não pode deixar o número do RDO incoerente sem avisar (ex.: emprestar mais gente do que a linha tem).
- Nada de `localStorage`/`sessionStorage` (regra do projeto).

## Abordagens consideradas

1. **Ocorrências separadas (ESCOLHIDA)** — tabela nova `efetivo_ocorrencias` (empréstimo, saída antes, parados);
   linhas de efetivo intactas; uma função pura calcula pessoas e HH. Mexe pouco no que funciona; lê bem no RDO.
   Custo: ocorrência pode ficar incoerente com a linha (ex.: linha reduzida para 1, empréstimo de 2) → a tela avisa.
2. **Linhas de efetivo com horário** — cada linha ganha início/fim/situação/"veio de"; HH trivial, mas a tela precisa
   esconder as divisões, contar pessoas fica frágil (mesma pessoa em várias linhas) e o salvamento/conflito do
   efetivo teria de ser refeito. Rejeitada.
3. **Só alertar quando a soma passar do previsto** — barato, não corrige o número. Rejeitada.

## Decisões do usuário

- Empréstimo: modelo "Emprestar" — a origem registra; as pessoas continuam contadas na origem; as horas a partir do
  horário informado passam para o destino. O destino **não** lança essas pessoas e **não** precisa aceitar: vê uma
  linha automática "+2 Montador de andaime (da Rita, 13:00–17:00)".
- Saída antes: "N pessoas da função F saíram às HH:MM" — contam como pessoas, geram HH só até a saída.
- Parados: "N pessoas da função F paradas de H1 a H2, causa C" (mesma lista de causas das atividades) → HH parado.
- Intervalo de refeição **por obra, como janela de horário** (não só duração), para não descontar almoço de quem
  saiu antes dele. Padrão em obra nova e nas existentes: diurno 12:00–13:00; o noturno tem a sua própria janela
  (proposta: 00:00–01:00; ajustável). Editável na página da obra.
- Empréstimo tem "até" **opcional** (volta à origem no horário informado); sem "até", fica no destino até o fim.
- **Quem está com as pessoas registra.** Saída antes e Parados lançados pela origem valem para quem ficou na origem.
  Se os emprestados pararem ou saírem antes, quem registra é o destino, na linha recebida "+2 Montador (da Rita)",
  que oferece só essas duas ações (a ocorrência aponta para o empréstimo). As horas caem sempre na equipe certa.
- **Passado não muda:** cada turno guarda a sua janela de intervalo ao ser criado (copiada da obra). Turnos já
  fechados ficam sem intervalo (HH igual ao de hoje); turnos abertos e novos recebem o padrão. Mudar o intervalo
  da obra só afeta turnos criados depois; o planejador pode ajustar o intervalo de um turno aberto na tela do turno.
- Quem lança: responsável (link de campo `/t/[token]`, só a própria equipe e as linhas recebidas) e planejador
  (tela do turno, qualquer equipe).
- "Outra função…": recusar texto contendo "parado"/"parada"/"ocioso" e apontar para o botão Parados.
- Horário real vazio → usa o previsto (regra atual do `hhTurno` mantida).

## Tela (campo e turno)

```
Efetivo — Rita
  6  Montador de andaime        [− +]
     ↳ 2 emprestados → Ana  a partir de 13:00   ✕
     ↳ 1 saiu às 15:00                           ✕
     ↳ 2 parados 08:00–10:00 · Material          ✕
  [+ Emprestar]  [+ Saída antes]  [+ Parados]

Efetivo — Ana
  5  Caldeireiro                [− +]
  + 2 Montador de andaime  (da Rita, 13:00–17:00)   ← automático
     [+ Saída antes]  [+ Parados]                   ← só essas ações nos recebidos
```

- Cada ocorrência fica pendurada sob a função a que se refere; ✕ remove.
- Formulários curtos: Emprestar = quantidade, função (das linhas da equipe), equipe destino (responsáveis ativos da
  obra exceto a própria), a partir de (hora). Saída antes = quantidade, função, hora. Parados = quantidade, função,
  de, até, causa.
- Resumo por equipe abaixo da lista: "6 pessoas · 52 HH (4 HH parados)".

## Regra de cálculo (função pura, ex. `lib/dominio/efetivoHH.ts`)

Entrada: linhas de efetivo (por equipe), ocorrências, janela do turno (real, senão prevista), janela de intervalo do
período. Saída por equipe e total: `pessoas`, `hhProdutivo`, `hhParado`, `hhParadoPorCausa`, `hh` (= produtivo +
parado, o "HH total" de hoje corrigido).

- **Pessoas da equipe** = Σ quantidade das suas linhas (emprestadas continuam aqui). **Total do turno** = Σ das equipes
  (sem contar recebidas).
- Horas de uma pessoa = duração da sua janela de trabalho ∩ janela do turno − sobreposição com o intervalo.
- Empréstimo (N, de H até H'): N pessoas da origem trabalham na origem fora de [H, H'] e no destino dentro de
  [H, H'] (H' ausente = fim do turno).
- Saída antes (N, H): N pessoas param de trabalhar em H. Lançada pela origem → aplica-se às que estão na origem;
  lançada pelo destino sobre um empréstimo → aplica-se a esses emprestados (encerra também o empréstimo em H).
- Parados (N, H1–H2, causa): as horas [H1,H2] ∩ janela de trabalho − intervalo saem do produtivo e vão para
  parado. Lançado pela origem → pessoas da origem, HH parado da origem; lançado pelo destino sobre empréstimo →
  emprestados, HH parado do destino.
- Intervalo = janela gravada no turno (pode ser nula → nada descontado).
- Janelas que atravessam meia-noite (noturno) seguem o `horasEntre` atual.
- Sem horário (nem real nem previsto) → HH = null, como hoje.

## Coerência e avisos

- Validação no servidor ao gravar uma ocorrência: quantidade > 0; horas dentro da janela do turno; destino ≠ origem e
  da mesma obra; função existe nas linhas da equipe naquele momento.
- Depois de gravadas, se a linha mudar (redução da quantidade ou remoção da função), a ocorrência **não** é apagada:
  a tela mostra aviso "2 emprestados, mas a linha tem 1" e o cálculo limita ao que a linha tem (nunca conta mais
  pessoas/horas do que existem). Ordem do corte (decisão de Claude, conferida pelo usuário): as ocorrências são
  aplicadas na ordem em que foram registradas (`created_at`); a que exceder o disponível é cortada no excedente. Fechar turno com ocorrência incoerente: permitido, com o aviso visível no resumo.
- Turno fechado: ocorrências imutáveis (mesmo gatilho dos outros filhos).

## Dados

- `obras`: `intervalo_diurno_inicio time`, `intervalo_diurno_fim time`, `intervalo_noturno_inicio time`,
  `intervalo_noturno_fim time` (padrão da obra; migration preenche as existentes e define default).
- `turnos`: `intervalo_inicio time`, `intervalo_fim time` (nulos = sem intervalo). Copiados da obra conforme o
  período na criação do turno; migration preenche só turnos não fechados.
- `efetivo_ocorrencias`: `id`, `turno_id` (cascade), `responsavel_id` (origem; null = "Sem responsável"), `funcao`,
  `tipo` (`emprestimo` | `saida` | `parado`), `quantidade int > 0`, `hora_inicio time`, `hora_fim time` (parado
  obrigatório; empréstimo opcional), `destino_responsavel_id` (emprestimo), `emprestimo_id` (saída/parado lançado
  pelo destino sobre um empréstimo; cascade), `causa` (parado; mesmo check das atividades), timestamps, RLS igual a
  `efetivo`, índice em `turno_id`, gatilho de turno fechado, gatilho de responsável da mesma obra.
- Ocorrência é registrada inteira (criar/remover), não editada — evita conflito de edição; criar/remover concorrentes
  não se anulam.
- Fotos/versões: incluir as ocorrências e a janela de intervalo no JSON da versão oficial do RDO (`turno_eventos`) e
  na foto do check-in (`foto_checkin`); versões antigas sem esses campos continuam lidas como hoje (HH antigo).

## Onde muda

- `lib/dominio/calculos.ts` `hhTurno` → substituído/encapsulado pela nova função; consumidores: `resumo.ts`
  (Resumo do turno), `quadro.ts` (quadro e TV), `programacao.ts` (`PrevistoReal`: HH real; HH previsto também
  desconta intervalo), `lib/rdo/secoes.tsx`.
- RDO: métricas "Efetivo total", "HH" e nova "HH parado"; seção de efetivo lista por função e, abaixo, as
  ocorrências em texto ("2 Montador de andaime emprestados → Ana a partir de 13:00"; "2 parados 08:00–10:00 —
  Material").
- Quadro: por equipe "6 pessoas · 52 HH · 4 HH parados"; linha recebida aparece na equipe destino.
- Campo `/t/[token]` e turno `EfetivoPorEquipe`/`BlocoEfetivo`: botões e lista de ocorrências.
- Página da obra: editar janelas de intervalo.

## Testes

- Unitários da função pura cobrindo: caso Rita/Ana (17 pessoas, HH transferido), saída antes do almoço, parado
  atravessando o almoço, noturno atravessando meia-noite, incoerência limitada, sem horário.
- Integração: gravar/remover ocorrência, validações, turno fechado imutável, versão do RDO com ocorrências.
- E2E: Rita empresta 2 para Ana pelo link → quadro e RDO mostram 17 pessoas e HH correto.

## Deixado para quem constrói

- Nome exato dos arquivos/funções, layout fino dos formulários, texto exato dos avisos.
- Mecanismo de salvar ocorrência no campo (server action no padrão de `app/t/[token]/acoes.ts`, com repetição de
  `repeticao.ts` e registro em `rastreioSalvamento`).
