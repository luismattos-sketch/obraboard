# Sinal fraco de canteiro + "Salvo ✓" enganoso — desenho curto

Backlog itens 2 e 3 (Prioridade 1 — Confiança no dado), feitos juntos porque mexem nas mesmas peças.
Origem: teste do Carlos (achados 1–4) e Ana/João/Rita
([docs/testes/2026-11-16-fluxo-completo/carlos.md](../../testes/2026-11-16-fluxo-completo/carlos.md)).

## Por quê
No canteiro, sinal de um risquinho é o normal. Hoje o app desiste em ~26 s ("Recarregue a página"), não tenta
de novo quando a rede volta, e recarregar apaga o digitado. O selo "Concluída" fica verde e o "Salvo ✓" antigo
continua aparecendo antes do banco confirmar. Quem lê pouco olha o verde e guarda o celular.

## Objetivos
- Nunca desistir de salvar enquanto a tela estiver aberta.
- Tentar de novo na hora quando a rede volta, quando a pessoa volta para a tela, ou num botão.
- Nunca mostrar sucesso (verde) antes de o banco confirmar.
- Deixar visível que há lançamento não salvo e pedir confirmação do navegador antes de sair/recarregar.

## Fora do escopo / decidido
- **Nada guardado no celular** (decisão do usuário, regra do projeto): se a pessoa confirmar a saída, ou o
  celular fechar o navegador, o pendente se perde. Sem service worker / envio em segundo plano.
- Clareza do "Concluída" trocar o parcial pela meta e botão Salvar explícito (item 11).
- Tamanho/estilo do aviso de sem sinal além do descrito aqui (item 12).

## Abordagens consideradas
1. **Reforçar o auto-salvamento de cada bloco (escolhida).** `useAutoSalvar` passa a nunca desistir e a
   avisar um registro central (o mesmo que já trava "Enviar turno"), que alimenta o aviso no topo e a pergunta
   ao sair. Pequena e mantém a proteção contra aba velha do item 1.
2. Uma fila única de envios para a tela inteira: reescreve os quatro blocos e a proteção do item 1; mesmo
   resultado na tela, mais risco.
3. Guardar e enviar em segundo plano: excluída pela decisão acima.

## Desenho
**Repetição** (`components/execucao/repeticao.ts`): falha de rede (a action lançou) repete sempre, com intervalo
crescente 5 s, 10 s, 20 s, 30 s e depois a cada 30 s. Sem conexão (`navigator.onLine === false`) espera o
evento `online` (e tenta a cada 30 s mesmo assim). Some a mensagem "Recarregue a página".
Erro de negócio (`ok:false`: conflito, turno fechado, número inválido) continua sem repetir, como hoje.

**Tentar já:** a repetição agendada é antecipada quando a rede volta (`online`), quando a tela volta a ficar
visível, e no botão **"Tentar de novo"** do bloco (e no aviso do topo, que tenta todos).

**Indicador do bloco** (`IndicadorSalvo`): na mesma hora da edição mostra "Salvando…" (não espera os 800 ms
do debounce; o "Salvo ✓" antigo some na hora). Após falha de rede: "Não salvo — sem sinal. Tentando de novo…"
com o botão "Tentar de novo". "Salvo ✓" só depois da confirmação do banco.

**Selo da atividade:** enquanto a edição não for confirmada, o selo (Concluída/Parcial/Não iniciada) fica em
tom neutro (cinza); ganha a cor só depois de salvo.

**Registro central** (`rastreioSalvamento.tsx`): passa a saber, por bloco, "salvando" × "falhou" e como
antecipar. Com isso:
- **Aviso no topo** (fixo no alto da tela, só quando algum bloco falhou — não pisca nos salvamentos normais):
  "⚠ 1 lançamento não salvo. Não feche nem atualize esta tela." (plural: "2 lançamentos não salvos") e botão
  "Tentar de novo".
- **Pergunta ao sair:** com qualquer bloco salvando ou falhou, `beforeunload` pede confirmação do navegador.
- "Enviar turno" continua travado enquanto houver pendência (hoje é liberado quando o app desiste; deixa de
  existir o desistir).

**Rede voltou:** além da volta para a aba (item 1), a página também pede dados novos (`router.refresh()`) no
evento `online`, se não houver salvamento pendente.

Vale para o link de campo e para a tela de correção do planejador (mesmos componentes).

## Testes
- Unidade: sequência de intervalos e "nunca desiste" em `decidirRepeticao`; textos do aviso (singular/plural).
- E2E (Playwright, celular emulado): bloquear as gravações (`page.route` abortando o POST) por mais de 40 s →
  continua "Não salvo…", aviso no topo visível, "Enviar turno" travado, selo neutro; liberar a rede e tocar
  "Tentar de novo" → "Salvo ✓" e o banco tem o valor. `context.setOffline(true/false)` → volta sozinho ao
  ficar online. Fechar a página com pendência dispara o diálogo `beforeunload`.
- Componente (renderToStaticMarkup): indicador "Não salvo…" com botão; selo neutro com edição pendente.

## Fica com quem constrói
Formato do registro central (ids, estados e funções de antecipar); se o "Salvando…" imediato vem de um estado
"alterado" no `useAutoSalvar` ou do próprio "salvando"; posição exata do aviso fixo sem cobrir o cabeçalho.
Conferir em celular real (o teste usa emulação).
