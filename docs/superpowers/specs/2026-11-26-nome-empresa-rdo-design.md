# Nome da empresa no RDO + "Minha empresa" (backlog 7.5)

**Por quê:** o RDO não diz quem o emitiu. No plano gratuito a empresa aparece pelo nome; trocar o logo do Frentia
pelo da empresa é benefício do plano pago mais barato (7.6, depende do épico 7 — Cobrança). Pedido do Luis em 2026-11-26.

## Decidido
- **Cabeçalho fixo do PDF** (todas as páginas): `[logo Frentia]   NOME DA EMPRESA (centralizado)   RDO · obra · data`.
  Negrito, cor primária, uma linha; nome longo cortado com "…".
- Vale no RDO do turno (`lib/rdo/documento.tsx`) e na capa do lote mensal (`lib/rdo/capa-lote.tsx`). Versões já emitidas
  não são regravadas; ao baixar de novo, saem com o nome (o nome vem da empresa atual, não da foto da versão).
- **Página "Minha empresa"** no menu lateral: um campo "Nome da empresa (aparece no RDO)", salva sozinho (padrão do app,
  "Salvando…/Salvo"), obrigatório, sem `localStorage`. Abaixo, aviso: "Trocar o logo do Frentia pelo da sua empresa:
  disponível no plano pago (em breve)".
- Fonte: `empresas.nome` (já existe, preenchido no cadastro). Sem migration, salvo se a RLS não permitir o dono
  atualizar o nome — aí uma policy de update para o papel "dono".
- Manual (capítulo de primeiros passos ou RDO), captura da página nova, Novidades.

## Fora (7.6, plano pago)
Envio do logo, limite de tamanho e redução automática (o PDF do mês tem teto de 4,5 MB na Vercel), troca do logo no
cabeçalho. Nada de noção de plano agora.

## Abordagens consideradas
- A. Só o nome no PDF — descartada: nome errado no cadastro ("teste") sairia em todo RDO sem conserto pelo app.
- **B. Nome no PDF + "Minha empresa" (escolhida)** — permite corrigir e já é o lugar do envio do logo no 7.6.

## Para o construtor decidir
Rota da página (sugestão `/empresa`), ícone no menu, como o nome chega ao PDF (rota de download e lote já leem a obra;
ler `empresas.nome` pelo `empresa_id` da obra).
