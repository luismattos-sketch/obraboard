# Quadro único (check-in/check-out) com resumo do clima

## Por quê
O quadro é para TV/gestor/equipe: tem de abrir só com o link e mostrar a situação real do turno, sem alternar visões nem editar. O clima ajuda a decidir o dia no check-in.

## Objetivos
1. Acesso só pelo link público `/q/<código>`; sem login.
2. Uma tela só: saem as abas Check-in/Check-out e o botão Editar. Selo na barra azul: **CHECK-IN** até a primeira atividade iniciada; depois **CHECK-OUT**. Mantém ← Agora →, "Turno fechado" e a hora de atualização.
3. Cartão-resumo do clima: mín/máx, chuva acumulada, ícone da condição.

## Não-objetivos
- Não apagar `checkin_fotos` nem dados antigos (só deixa de gravar/ler).
- Não mexer no RDO/clima do turno além de permitir previsão no turno planejado.

## Abordagens
- **Escolhida:** quadro público único; `/obras/[id]/quadro` deixa de existir e o menu "Quadro" abre o link público (ou leva à geração do link se não houver).
- Descartada: manter quadro interno + público — duplica a tela sem ganho.

## Decisões
- Fase: calculada pelo estado das atividades (alguma iniciada → checkout), não mais por `?visao=`.
- Clima: reaproveita `climaParaTela`; gravado se fechado; ao vivo (cache 30 min) em campo; **previsão também no turno planejado** (aprovado). Obra sem cidade: cartão some.
- Docs: manual (`lib/ajuda/`), capturas, fluxograma e Novidades atualizados; deploy na Vercel.

## Para o implementador
- Onde exatamente cada item do clima aparece no layout do quadro.
- Redirecionamento da rota antiga `/obras/[id]/quadro` (decisão do implementador: redirecionar para a obra/link).
