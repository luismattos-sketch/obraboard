# Item 10 — Dados do turno compartilhados e permissões no campo

**Por quê:** no teste de 2026-11-16, responsáveis sobrescreveram horário/clima uns dos outros, "Ver tudo" editava tudo
e enviava o turno, "Trocar" lançava como outra pessoa sem confirmar e não havia registro de quem alterou.
Objetivo: cada pessoa só mexe no que é dela; dado do turno sem ambiguidade.

## Abordagens
- **A (escolhida pelo Luis):** horário real, clima e envio ficam com o planejador.
- B: responsável principal por turno (mais uma escolha diária para o planejador).
- C: todos editam com "alterado por" (não resolve a sobrescrita).

## Desenho
**Link de campo (/t/[token])**
- Horário real e clima só leitura ("—" se vazio; sem pré-preencher 07:00).
- "Ver tudo" (?r=todos) só leitura: todas as equipes, sem edição nem botões de ação.
- Sem "Enviar turno" no campo. Turno vira `enviado` sozinho quando todos os responsáveis com atividade no turno
  marcam "Terminei minha parte"; "Desfazer" de algum volta para `em_campo`.
- Servidor recusa: horário/clima vindos do campo; lançamento (execução, efetivo, ocorrência) de outro responsável.
- Ao escolher um nome: confirmação "Você é a Ana? [Sou eu] [Não, voltar]" antes de editar. Escolha segue só na URL
  (sem localStorage/sessionStorage).

**Planejador**
- Continua editando horário e clima na tela do turno.
- Histórico = última alteração: atividade e linha de efetivo guardam quem alterou e quando (`alterado_por` responsável
  ou planejador + `alterado_em`), exibido como "Ana · 09:12" / "você · 10:05".

**Fora do escopo:** histórico completo (antes→depois); responsável principal.

**Junto no PR:** manual (lib/ajuda/), capturas, fluxograma (envio mudou), Novidades.

## Deixado ao construtor
Forma exata das colunas/migration, onde o selo aparece no card, texto da confirmação na tela.
