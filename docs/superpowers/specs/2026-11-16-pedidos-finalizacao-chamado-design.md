# Pedidos: finalização do chamado e tempos de atendimento

> Esta especificação preserva o ciclo de chamados e pedidos. Pagamentos e encerramento financeiro de comandas estão definidos em [pagamentos e fechamento de comanda](2026-11-16-pagamentos-fechamento-comanda-design.md).

## Intenção

Ao confirmar o pedido da mesa, registrar todos os itens na comanda e concluir o chamado em uma única transação. Exibir no histórico quanto tempo o chamado aguardou até ser assumido e quanto tempo o atendimento durou.

## Estado atual

- A seleção de itens, categorias, pesquisa com debounce, quantidades, observações e acréscimos já existe em `CallOrderDialog`.
- O painel atual ocupa a tela inteira, mas usa o primitivo `Dialog`, embora o fluxo tenha sido pedido como `Sheet`.
- A página Caixa lista comandas abertas e atualiza em tempo real.
- `service_calls` já guarda `created_at`, `claimed_at` e `resolved_at`. A leitura do painel já entrega esses timestamps ao histórico.
- `record_panel_order` cria o pedido e a comanda dentro de uma transação, mas não altera o estado do chamado. O fluxo também tem uma ação separada de encerramento manual.

## Objetivos

- Usar o primitivo `Sheet` existente em tela cheia, mantendo o layout atual, acessibilidade, animações e estados de carregamento/erro.
- Fazer com que um pedido confirmado finalize o chamado atomicamente com a gravação da comanda e dos itens.
- Reconciliar chamados ainda em atendimento que já tenham pedido associado, usando o último `orders.created_at` como horário de finalização e o responsável do chamado como autor do encerramento.
- Mostrar no cartão de chamados finalizados os intervalos `created_at → claimed_at` e `claimed_at → resolved_at`.
- Após uma confirmação bem-sucedida, fechar o Sheet, atualizar a fila e informar que o pedido e o atendimento foram concluídos.

## Fora de escopo

- Mudanças no ciclo de chamados ou pedidos decorrentes do fluxo de pagamentos. O fechamento financeiro de comandas está tratado na especificação posterior de pagamentos.
- Novo painel analítico ou agregações de tempo por período/equipe.
- Novas colunas para durações: os horários existentes são a fonte de verdade e as durações são derivadas.
- Reestruturação do catálogo, da comanda ou dos componentes existentes além do necessário para usar `Sheet`.

## Abordagens consideradas

1. **Chamar a finalização depois da gravação no cliente.** Pouca alteração no banco, mas pode deixar pedido/comanda confirmados com chamado aberto se a segunda chamada falhar. Não atende à integridade exigida.
2. **Reescrever `record_panel_order` para incluir a finalização.** Mantém tudo em uma transação, mas exige copiar e manter uma função SQL extensa.
3. **Resolver o chamado em um gatilho `AFTER INSERT` de `orders`, dentro da transação atual, e reconciliar dados antigos na migração.** É a escolha: mantém atomicidade com uma migração pequena, usa as validações já feitas pela função de pedido e cobre qualquer gravação vinculada a chamado. O gatilho rejeita a gravação se o pedido não corresponder ao chamado em atendimento e à pessoa responsável.

## Integridade e tempos

- O gatilho só encerra chamado em `in_progress`, associado à mesa e restaurante da comanda, atribuído a `orders.created_by`. A falha aborta a gravação do pedido, e o RPC existente traduz o conflito.
- Chamados ativos com pedidos existentes serão reconciliados na migração. Se houver mais de um pedido associado, o horário do último pedido será usado. `resolved_by` recebe `claimed_by`.
- Os tempos são diferenças entre timestamps persistidos no PostgreSQL, não relógios do navegador. Se algum intervalo estiver ausente, não será exibido; valores negativos serão limitados a zero na apresentação.
- A confirmação bem-sucedida encerra e fecha o Sheet. Erros e envios de resultado incerto continuam mantendo o carrinho protegido pelo `request_id` atual.

## Decisões de implementação

- Manter o contrato atual do RPC e do modelo TypeScript; nenhuma coluna ou ação nova é necessária.
- Adicionar uma migração Supabase para reconciliação, função do gatilho e ativação do gatilho.
- Alterar apenas os componentes de chamado/pedido para usar `Sheet`, publicar feedback de sucesso na fila e apresentar os tempos no histórico.
- Respeitar `AGENTS.md`: não executar `git`, testes, build, lint ou typecheck. A revisão será por leitura das mudanças e conferência manual das invariantes do SQL e da UI.
