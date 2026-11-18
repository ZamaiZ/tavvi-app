# Refinamento de Caixa, Financeiro e Gorjeta

> Status: aprovado e implementado em 2026-11-17; conferência final estática concluída. Nenhum teste, lint, build, typecheck ou comando Git foi executado, conforme AGENTS.md.

## Intenção

Reduzir a sobrecarga visual das páginas de Caixa e Financeiro e separar a operação de comandas da operação do caixa físico. Caixa deve levar rapidamente à comanda e ao pedido. Financeiro deve começar com um resumo legível e revelar análises, movimentações e controles do caixa do dia quando a pessoa pedir.

## Estado anterior ao refino

- `/caixa` renderiza o painel de sessão física antes da lista de comandas. O painel mostra ações, valores e até 12 eventos recentes. Depois vêm três cartões de resumo e a lista. Ver `features/panel/orders/components/cash-workspace.tsx` e `features/panel/cash/components/cash-session-panel.tsx`.
- A leitura inicial do Caixa carrega pedidos, itens, adicionais e pagamentos de todas as comandas consultadas; também carrega o catálogo e eventos da sessão antes de saber se serão abertos. A expansão do cartão revela dados que já vieram no payload. Ver `features/panel/orders/server/read.ts` e `app/painel/(workspace)/caixa/page.tsx`.
- Atualizações pós-ação e eventos de comanda podem chamar `router.refresh()` na rota inteira, repetindo leituras não relacionadas. A divisão proposta também deve restringir a atualização ao DTO afetado.
- O Financeiro exibe quatro indicadores, gráfico, movimentação/conciliação do caixa e três listas de composição na mesma página. `getPanelFinanceDashboard` já agrega os dados no banco, mas envia todos os detalhes na carga inicial. Ver `features/panel/finance/components/finance-dashboard.tsx` e `features/panel/finance/server/read.ts`.
- Configurações financeiras já vivem em `/financeiro/configuracoes`, mas hoje cobrem apenas formas de pagamento. O modelo persistente atual não tem regra nem decisão de gorjeta.

## Objetivos

- Fazer comandas e pedidos aparecerem antes de conteúdo financeiro secundário em Caixa.
- Manter no topo de Caixa apenas um estado compacto da sessão e, no máximo, três indicadores operacionais: comandas abertas, saldo a receber e dinheiro esperado na sessão aberta.
- Manter pagamento e finalização da comanda no fluxo do Caixa. Se a sessão estiver fechada, oferecer acesso direto à operação de abertura em Financeiro.
- Colocar abertura/fechamento da sessão física, reforços, retiradas, despesas e histórico de eventos em uma área "Caixa do dia" dentro de Financeiro.
- Fazer o resumo financeiro inicial caber em uma leitura rápida: intervalo, vendas, recebimentos e despesas; tratar saldo pendente como informação secundária. Análises por forma/categoria e conciliação aparecem sob demanda.
- Buscar detalhes da comanda, catálogo, eventos financeiros e detalhamentos analíticos somente quando necessários.
- Configurar gorjeta por restaurante como desativada, percentual ou valor fixo por comanda.
- Preservar escolha explícita de aceitar/recusar gorjeta, trilha de auditoria e valores históricos.

## Fora do escopo

- Não redesenhar outras áreas do Painel.
- Não introduzir papéis/permissões novos para acessar Caixa ou Financeiro.
- Não transformar gorjeta em receita do restaurante, forma de pagamento ou cobrança automática.
- Não alterar regras de consumo, fechamento de comanda ou pagamentos além do que for necessário para encaixar a decisão e o valor da gorjeta.

## Abordagens consideradas

1. **Reorganização visual apenas:** recolher painéis e mover cartões sem alterar leituras. É menor, mas mantém cargas desnecessárias e não atende ao lazy loading real.
2. **Separar responsabilidades nas páginas existentes (escolhida):** Caixa prioriza comandas; Financeiro tem um resumo inicial e uma área acionada "Caixa do dia" para controles físicos. As leituras de detalhe são feitas na interação correspondente. Corresponde à divisão pedida e evita uma nova área de navegação.
3. **Criar um módulo/rota independente para operação física:** dá isolamento maior, mas acrescenta navegação para uma área que pode ser organizada como seção do Financeiro.

## Organização proposta

### Caixa

- Barra curta de estado: caixa aberto/fechado, valor esperado em espécie e link "Gerenciar caixa" para Financeiro.
- Três indicadores compactos: comandas em atendimento, pedidos vinculados e saldo a receber. Se não existir sessão aberta, a barra informa esse estado e o link leva à abertura.
- Abas de comandas abertas e encerradas, busca e ação "Novo pedido".
- Lista com resumo compacto por comanda. Ao expandir/selecionar, buscar itens, adicionais, pagamentos e histórico completos daquela comanda.
- Manter pedido, recebimento e finalização de comanda aqui. Adicionar uma ação explícita "Encerrar consumo" que bloqueia novos pedidos e inicia a liquidação; não confundir encerramento do consumo com encerramento da comanda.
- Ao encerrar o consumo, registrar a escolha explícita de gorjeta antes de calcular o saldo final. Comanda em liquidação sem decisão (por exemplo, transportada no fechamento do caixa) apresenta a escolha antes do primeiro pagamento, gravando decisão e pagamento atomicamente quando enviados juntos.
- Sem sessão aberta, o fluxo continua bloqueando pagamento, mas oferece um link direto para Financeiro.

### Financeiro

- Visão inicial: filtro de período e três indicadores principais — vendas, recebimentos e despesas. Gráfico resumido pode permanecer como visualização primária abaixo deles.
- Detalhamentos por formas de recebimento, categorias/formas de despesa e conciliação ficam em seção secundária ou abas carregadas ao abrir.
- Área "Caixa do dia" separada da visão analítica contém abertura, reforço, retirada, despesa, fechamento e eventos da sessão. Abri-la busca sessão e movimentos; a visão geral não busca os 12 eventos da sessão.
- A rota de configurações financeiras recebe a regra de gorjeta junto das formas de pagamento.

### Configuração e aplicação da gorjeta

- Modos persistidos: `disabled`, `percentage` ou `fixed`; percentual em pontos-base e valor fixo em centavos. Validar no servidor e banco; não confiar em valores calculados pelo navegador.
- O valor fixo é uma sugestão por comanda, seguindo o modelo de produto já registrado. A gorjeta só é incluída após aceite explícito; recusa define zero e é uma escolha válida. Modo desativado não solicita decisão.
- A decisão acontece na ação explícita de encerramento do consumo. Para comanda transportada sem decisão, apresentar aceite/recusa antes do primeiro recebimento. Persistir modo/valor da regra aplicada, valor calculado, escolha, ator e horário como snapshot da decisão.
- Alterar uma configuração afeta comandas ainda sem decisão; decisões tomadas e comandas encerradas preservam o histórico.
- Gorjeta aceita compõe o total e o saldo a receber e é paga pelos mesmos meios da comanda. No Financeiro, mostrar gorjeta como parte/subindicador dos recebimentos, sem somar novamente.
- Em recebimentos parciais, atribuir pagamentos primeiro ao subtotal do consumo e depois à gorjeta; cada pagamento guarda quanto liquidou de gorjeta para que o relatório por período use a data real do recebimento.
- Mostrar ao cliente e à equipe o valor sugerido e que o pagamento é opcional; não marcar aceite por padrão nem inferir aceite por silêncio.

## Restrições

- Manter centavos inteiros para valores monetários e operações críticas atômicas/idempotentes no banco.
- Preservar isolamento por restaurante, membership e RLS.
- Usar agregações do banco para resumos; não carregar todas as linhas de pedidos para somar no navegador.
- Preservar o comportamento responsivo e acessível já utilizado no Painel.
- Respeitar o `AGENTS.md`: não executar `git`, testes, lint, build ou typecheck.
- Antes de alterar código, ler a documentação local pertinente do Next.js 16.4.6 em `node_modules/next/dist/docs/`.

## Pontos para o plano de implementação

- Rever a função `getPanelComandasPage` para separar resumo paginado dos detalhes sob demanda e evitar agregação dos totais lendo todos os filhos.
- Não carregar `getPanelMenu` na renderização inicial de Caixa; carregar quando "Novo pedido" abrir, com cache por restaurante se o padrão local permitir.
- Separar leitura resumida da sessão e leitura de eventos/detalhes usados pela área "Caixa do dia".
- Separar "encerrar consumo" de "quitar/encerrar comanda" e atualizar os estados `open`, `pending` e `closed` de forma transacional.
- Dividir a RPC/DTO do Financeiro entre indicadores iniciais e detalhamentos sob demanda, preservando filtros por calendário no fuso do restaurante.
- Adicionar configuração, validação, persistência e auditoria da gorjeta em migração/RPCs e interfaces de configuração.
- Integrar a decisão da gorjeta no fechamento de consumo e no recebimento posterior sem permitir pagamento duplicado ou valor zero indevido.
- Atualizar `__BASE.MD` e as especificações financeiras anteriores para resolver o conflito de responsabilidade das operações físicas e marcar gorjeta como incluída no escopo.

## Escolhas deixadas para implementação

- Manter o chart de vendas/recebimentos visível no resumo somente se couber sem empurrar os cartões de análise; caso contrário, carregá-lo ao abrir "Tendência".
- Usar a navegação mais curta já existente para abrir a área "Caixa do dia" no Financeiro, preservando URL direta para o fluxo vindo do Caixa.
- Para percentual, usar cálculo em centavos inteiros com arredondamento monetário consistente e documentado na RPC.
