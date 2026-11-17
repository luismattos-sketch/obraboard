# Links de campo e da TV sempre visíveis (backlog item 5)

Design curto (mudança pequena). Origem: teste do fluxo completo, planejador fase 1, achado A1.

## Intenção
O planejador dá F5, troca de aba ou fecha o notebook antes de mandar o link e ele some ("não será exibido de novo").
Se gerar outro, o link já mandado no WhatsApp ou o da TV param de funcionar sem aviso. O link certo tem que
continuar à vista e gerar um novo tem que ser uma decisão consciente.

## Objetivos
- Link de campo (página do turno) visível sempre que o turno estiver em campo ou enviado, com "Copiar link" e
  "Enviar pelo WhatsApp", também depois de recarregar.
- Link do quadro (página da obra) visível sempre que existir, com "Copiar" e "Abrir".
- "Gerar novo link" do campo passa a pedir confirmação (o da TV já pede): texto dizendo que o link enviado
  para as equipes / o da TV vai parar de funcionar.
- Sai o texto "Guarde este link: ele não será exibido de novo."

## Fora do escopo
- Link por responsável já com `?r=` (sugestão da Ana) — fica para o item 12/10.
- Mudar quem pode usar o link, permissões no campo (item 10).

## Abordagens consideradas
- **A — guardar o link em claro no banco, protegido pela RLS da empresa (escolhida).** Simples, sem segredo novo
  no Vercel. Quem é membro já vê e edita mais do que o link permite.
- B — guardar cifrado com chave no Vercel. Protege contra cópia vazada do banco, mas exige configurar segredo
  em PROD e DEV e acrescenta pontos de falha.
- C — não guardar; só confirmação e texto melhor. Não resolve o F5.

## Como fica (decidido)
- Migration: `turnos.token_campo text` e `obras.quadro_token text`. O hash continua sendo usado na busca do link
  (`/t/[token]`, `/q/[codigo]`) — nada muda nas rotas públicas.
- Ao liberar o turno, ao gerar novo link de campo e ao gerar link do quadro, grava-se o token em claro junto
  com o hash.
- Links já existentes (só hash): não dá para recuperar. A tela mostra "Este link foi criado antes desta
  atualização e não pode ser exibido. Gere um novo para vê-lo aqui sempre." com o botão de gerar (com confirmação).
- O token em claro nunca entra nas fotos (RDO, check-in, semana) nem nas telas públicas.

## Calls minhas (ajustáveis)
- Confirmação com `window.confirm`, igual ao link da TV que já existe.
- Turno fechado continua sem painel de link (como hoje); o token fica guardado, sem uso.
- Nome das colunas e textos exatos ficam para o plano.
