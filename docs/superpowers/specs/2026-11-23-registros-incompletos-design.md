# Planejador vê registros incompletos e cobra com um clique (backlog 10.4)

Data: 2026-11-23 · Status: rascunho para aprovação · Tamanho: pequeno (sem migration)

## Por quê

Dor nº 1: a informação do campo chega incompleta. Hoje o planejador só descobre o que falta quando tenta
Enviar/Fechar (lista "faltam causas" do item 8) — tarde. Ele precisa ver, por responsável, o que falta, durante o
turno (acompanhar) e principalmente no fim (antes do RDO), e cobrar a pessoa certa num toque.

## Objetivos

- Bloco **"O que falta"** no alto da página do turno (`em_campo`/`enviado`), agrupado por responsável.
- Botão **"Cobrar no WhatsApp"** por responsável: abre o WhatsApp com mensagem pronta e o link de campo dele.

## Não-objetivos

- Lembrete automático / envio pelo servidor (é o 10.3; exigiria serviço de WhatsApp pago).
- Tela nova da obra juntando turnos, contador na lista de turnos, efetivo real, clima, horário.
- Guardar "cobrado às …" (exigiria migration; fica para depois se o piloto pedir).

## Anti-objetivos

- Cobrar cedo demais (lição do item 8): no meio do turno, parcial sem causa **não** é falta.
- Mensagem genérica ("complete o RDO") — tem que dizer o quê, de qual atividade.

## Abordagens

1. **Bloco na página do turno + link wa.me (escolhida).** Função pura calcula as faltas; reaproveita telefone do
   responsável, `linkWhatsapp` e o token do link de campo. Barato, sem migration, sem custo por mensagem.
2. Tela "Pendências do dia" da obra (todos os turnos): mais útil com diurno+noturno, mas rota nova e mais consultas.
   Fica para depois.
3. Envio automático pelo servidor (API de WhatsApp): sem toque do planejador, mas custo, cadastro de número
   comercial e se confunde com o 10.3.

Luis entregou o "como"; escolha minha: 1.

## Desenho

### O que conta como falta (função pura `faltasDoTurno`, testada)

Por responsável, só atividades dele. Extra/adiantada seguem as regras atuais (sem causa).

| Falta | Quando aparece |
|---|---|
| Sem lançamento (`qtd_realizada` nula, atividade normal/atrasada) | sempre |
| Sem causa / "Outro" sem observação (`errosDeCausa`) | só na **hora de cobrar** |
| Texto da IA não lançado (`relatos_campo.lancado = false`) | sempre |
| Não apertou "Terminei" | só na hora de cobrar, e só se o turno é `em_campo` |

**Hora de cobrar** (por responsável): equipe apertou Terminei **ou** turno `enviado` **ou** passou do fim
(real, senão previsto; noturno vira o dia) no fuso de São Paulo. Antes disso o grupo aparece em tom neutro
("em andamento"); depois, em alerta. Sem horário de fim: só Terminei/enviado contam.

### Tela

```
O que falta                                    2 responsáveis
João — já devia ter fechado (fim 17:00)
  • Montagem tubo L3 — lançar quanto foi feito        [ir]
  • Solda suporte — informar a causa (3 de 8 un)      [ir]
  [Cobrar no WhatsApp]
Ana — em andamento
  • Pintura — lançar quanto foi feito                 [ir]
  [Cobrar no WhatsApp]
```

- Sem faltas: "Nada faltando ✓" numa linha (bloco não some, para o planejador saber que conferiu).
- "ir" rola até o card da atividade na edição de execução (mesmo `irPara` do item 8, abrindo o detalhe se preciso).
- Atualiza com a página (mesmo `useAtualizarAoVoltar`/refresh já usado); sem tempo real novo.

### Mensagem

```
Oi, João! Falta completar no Frentia — Obra X · 23/11 Diurno:
• Montagem tubo L3: lançar quanto foi feito
• Solda suporte: informar a causa
Abra aqui: https://www.frentia.com.br/t/<token>?r=<responsavelId>
```

- Telefone do responsável (normalizado por `normalizarWhatsapp`); sem telefone → wa.me sem número (escolher
  contato) e dica "cadastre o telefone em Responsáveis".
- Sem link de campo ativo → mensagem sem a linha "Abra aqui" e dica "gere o link de campo".
- Função pura `mensagemCobranca` em `lib/dominio/whatsapp.ts`.

### Manual

Atualizar `lib/ajuda/` (capítulo do acompanhamento do turno), capturas desse capítulo e uma linha em Novidades.
Fluxograma não muda (sequência igual).

## Deixado ao construtor

Nomes de componentes, posição exata do bloco (acima de "Resumo do turno"), textos finos.
