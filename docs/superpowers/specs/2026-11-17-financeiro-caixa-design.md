# Financeiro e Caixa Diário

> Status: escopo confirmado implementado; gorjetas, estornos e correções de consumo permanecem como direção separada da seção 10 de `__BASE.MD`.

## Objetivo

Adicionar um dashboard financeiro por período e sessões diárias de caixa físico ao Painel do restaurante. A equipe deve conseguir abrir o caixa com troco, acompanhar entradas e saídas, registrar despesas e pagamentos, conferir o valor esperado e fechar a sessão com auditoria. O Financeiro será a primeira página após o login de um restaurante ativo.

Esta especificação consolida as decisões respondidas nesta conversa e a direção financeira da seção 9 de `__BASE.MD`.

## Escopo funcional

### Financeiro

- Página de análise e consulta, sem mutações operacionais. Ações de abertura, pagamento, movimentação e fechamento ficam em Caixa.
- Filtro por intervalo de datas de calendário, no fuso do restaurante, com hoje como padrão. A primeira configuração de fuso usa `America/Sao_Paulo`.
- Exibir vendas registradas e recebimentos separadamente. Vendas pertencem ao horário de criação do pedido; recebimentos, ao horário de lançamento do pagamento; despesas e demais movimentações, ao horário em que foram registradas.
- Exibir despesas registradas em grupo próprio, com composição por categoria e forma de pagamento. Reforços e retiradas do caixa físico não são receita nem despesa; uma despesa paga em espécie gera um único lançamento e reduz o valor físico esperado.
- Resumir sessões encerradas pela data operacional de abertura, mostrando total esperado, total contado, valor absoluto das diferenças e quantidade de sessões com divergência. Sessões abertas ficam identificadas como pendentes de fechamento.
- Saldo pendente de comandas permanece separado de valores recebidos e de dinheiro no caixa.
- Resumos vêm de agregação no Postgres. Caixa exibe os 12 eventos mais recentes vinculados à sessão.

### Sessão física de caixa

- Uma sessão ativa por restaurante. A sessão recebe uma data operacional local na abertura e permanece nesse dia até fechamento explícito, mesmo que atravesse a meia-noite. Almoço e jantar pertencem à mesma sessão.
- A abertura aceita o valor total em centavos; contagem por cédulas/moedas não faz parte desta entrega.
- Reforço, retirada e despesa são eventos imutáveis com valor, responsável, horário e descrição. Despesas exigem categoria e forma de pagamento.
- Despesa paga em espécie exige sessão aberta e fica vinculada a ela; despesa eletrônica pode ser lançada sem sessão e não altera dinheiro esperado.
- Pagamentos em dinheiro realizados em uma sessão ficam vinculados a ela. Formas eletrônicas não alteram o saldo físico esperado.
- Dinheiro esperado = valor de abertura + pagamentos em dinheiro + reforços − retiradas − despesas pagas em dinheiro.
- O fechamento aceita o total contado, guarda o esperado, o contado e a diferença. Diferença diferente de zero exige justificativa.
- Fechamento normal é bloqueado enquanto houver comandas em consumo/liquidação. O fechamento excepcional exige confirmação e justificativa e transporta saldos pendentes para comandas sem mesa e sem novos pedidos, recebíveis na próxima sessão. Chamados seguem seu próprio ciclo.
- Sessões fechadas e seus eventos não são editáveis.

### Pagamentos e configurações

- Formas padrão configuráveis: dinheiro, débito, crédito, PIX, VA, VR e parceria. O restaurante também pode adicionar formas personalizadas. Formas usadas permanecem identificáveis no histórico mesmo após desativação.
- Pelo menos uma forma padrão ou personalizada precisa permanecer ativa.
- Pagamentos e demais gravações financeiras são idempotentes por `request_id`, validadas e gravadas em transação no Postgres.

### Fora do escopo desta entrega

- Gorjeta, decisão de gorjeta por comanda, estornos de pagamentos e correções de itens estão descritos na seção 10 de `__BASE.MD`, mas não foram implementados nesta etapa. Eles alteram total, saldo, fechamento e histórico das comandas e precisam de uma definição própria.

## Modelo de apresentação

- O dashboard usa cards para vendas, recebimentos, despesas e saldo pendente; gráficos comparam vendas e recebimentos ao longo do intervalo e discriminam recebimentos/despesas por forma/categoria.
- Não há segmentação por almoço/jantar neste corte.
- Caixa mantém as listas de comandas. Uma área de sessão apresenta estado aberto/fechado e ações contextuais; detalhes e histórico ficam sob demanda.
- Componentes locais, tema e tokens atuais do Painel; `Calendar`/`Popover` e `ChartContainer` já existentes; Motion com entrada sequencial curta e suporte a movimento reduzido.
- Loading com skeletons coerentes com o conteúdo final; estados de erro com retry e estados vazios com orientação acionável; navegação responsiva e controles acessíveis.

## Segurança e integridade

- Toda leitura permanece autenticada e restrita à membership ativa do restaurante via RLS.
- Gravações financeiras não recebem valores de totais confiáveis do navegador; RPCs recalculam saldos e conferem estado sob lock.
- Sessões, movimentações, formas personalizadas e pagamentos mantêm chaves compostas de restaurante, auditoria e trilha imutável.
- A análise não compartilha cache entre restaurantes e não depende da sessão física aberta.

## Premissas confirmadas

- Um dia operacional não é dividido por almoço/jantar.
- Toda movimentação deve ser registrada; despesas também são contabilizadas por categoria no Financeiro.
- PIX é uma forma configurável.
- Sessões continuam vinculadas ao dia de abertura até fechamento explícito; filtros analíticos seguem dias de calendário no fuso local.

## Referência

- `__BASE.MD`, seções 9 e 10: responsabilidade do Financeiro, regras de sessão, fechamento, gorjeta, correções, auditoria e carregamento.
- Especificações existentes de pedidos, pagamento de comanda e pedido direto no Caixa.
