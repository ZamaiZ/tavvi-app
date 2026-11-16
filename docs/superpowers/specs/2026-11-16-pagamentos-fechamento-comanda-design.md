# Pagamentos manuais e fechamento de comanda

## Intenção

Permitir que a equipe registre pagamentos integrais ou parciais no Caixa, divididos entre várias formas, e feche uma comanda somente quando o saldo chegar a zero. Os registros são evidências manuais de operação: Tavvi não processa cobranças nem consulta intermediários.

## Estado atual

- As comandas são criadas e reutilizadas pela RPC de pedidos. O esquema só permite status aberto, e o Caixa carrega apenas comandas abertas.
- O total é derivado dos snapshots dos itens. Não existem pagamentos, saldo pago, saldo aberto ou fechamento.
- Desktop e celular mantêm árvores de navegação próprias, com o grupo Restaurante existente.
- O projeto usa Next.js 16.4.2, React 19.3.1, Supabase, Base UI/shadcn local e Motion.
- As especificações anteriores excluíam pagamentos e fechamento; este documento substitui essas exclusões para o escopo descrito abaixo.

## Objetivos

- Disponibilizar Configurações em Restaurante nas navegações desktop e móvel.
- Configurar por restaurante quais formas aparecem no lançamento: dinheiro, débito, crédito, VA, VR e parceria. Todas começam habilitadas.
- Registrar cada lançamento com uma ou mais linhas de forma e valor, responsável e horário. Usar centavos inteiros e preservar registros históricos mesmo após desativar uma forma.
- Calcular total da comanda, total pago e saldo em aberto a partir dos pedidos e pagamentos gravados.
- Manter a comanda aberta após pagamentos parciais.
- Fechar atomicamente quando o pagamento levar o saldo a zero e o operador marcar o fechamento. Se o saldo zerar sem a marcação, manter a comanda aberta e permitir fechá-la depois sem criar outro pagamento.
- Consultar comandas encerradas e seus lançamentos em uma aba Encerradas do Caixa, ordenada pelo fechamento mais recente e paginada.
- Refletir alterações do Caixa via Realtime e conservar os estados responsivos, acessíveis, animados e de movimento reduzido já usados pelo Painel.

## Fora de escopo

- Integração, autorização ou confirmação por Stripe, adquirente, maquininha ou outro intermediário.
- PIX nesta etapa; pode ser incluído posteriormente como outra forma configurável.
- Troco: cada valor informado representa o montante aplicado à comanda, não o dinheiro entregue pelo cliente.
- Estorno, edição ou exclusão de lançamento, gorjeta, taxa, sessão de caixa, desconto, impressão ou anexo de comprovante.
- Relatórios financeiros ou exportação.

## Abordagens consideradas

1. Armazenar formas e valores como JSON na comanda. Tem menos estrutura inicial, mas enfraquece o histórico, a integridade de lançamentos divididos e a atualização concorrente do saldo.
2. Usar um ledger de pagamentos com um evento por lançamento e linhas por forma de pagamento, mantendo configurações por restaurante. Esta é a abordagem escolhida: preserva cada registro, permite divisão, deixa a auditoria clara e dá ao banco uma fronteira transacional para validar saldo e fechamento.

## Regras de domínio

- As formas usam identificadores estáveis: cash, debit, credit, meal_voucher, food_voucher e partnership. Os rótulos visíveis são Dinheiro, Débito, Crédito, VA, VR e Parceria.
- A configuração pertence ao restaurante e exige ao menos uma forma habilitada. Uma forma desabilitada não pode ser usada em novo lançamento; seus registros antigos continuam legíveis.
- Um lançamento contém de uma a seis linhas; cada linha tem uma forma habilitada e valor positivo em centavos. A soma das linhas é o valor aplicado naquele lançamento.
- Parcial e integral são derivados comparando a soma do lançamento com o saldo atual. Valor zero, formato inválido e valor acima do saldo são recusados.
- O servidor e a RPC validam sessão, membership ativa, restaurante ativo esperado, formas habilitadas, estado da comanda e saldo atual. A RPC bloqueia a comanda antes de calcular o saldo, gravar o evento e, quando solicitado e devido, fechar.
- Cada lançamento usa request_id para repetição segura após falha de transporte. Repetir a mesma solicitação não cria novo pagamento. Uma tentativa sem resposta fica preservada na sessão do navegador e volta bloqueada para reenvio com os mesmos dados; edição só volta a ser possível depois de uma resposta definitiva.
- Encerrar sem pagamento só é permitido quando o saldo recalculado é zero. Uma comanda encerrada não recebe novos pagamentos nem pedidos; uma próxima visita à mesa pode abrir nova comanda.
- Os registros guardam identificador e nome de apresentação do membro como snapshot, além do instante do banco. O Caixa apresenta responsável, horário, formas e valores; não afirma que um provedor confirmou a transação.
- As operações continuam disponíveis a membros ativos do restaurante, conforme as permissões atuais do Painel.
- O Caixa separa Abertas e Encerradas. A aba Encerradas usa páginas de 25 registros, ordenados por closed_at decrescente, com pesquisa de mesa dentro da página.

## Experiência

### Configurações

- Rota Painel /configuracoes, no grupo Restaurante.
- Lista de seis opções com ícone, nome e switch; todos habilitados inicialmente.
- Exibir alterações pendentes e ação de salvar, confirmação de sucesso e erro junto à área de configuração. Desabilitar controles durante o salvamento.
- Não permitir salvar todas as formas desligadas.

### Caixa e pagamento

- No cartão aberto, destacar Total, Pago e Em aberto; incluir Registrar pagamento quando houver saldo.
- O formulário apresenta mesa e resumo do saldo. Cada linha contém seletor de forma, input de valor no padrão com ícone R$ do cardápio e remoção. Começa com uma linha e permite adicionar até uma linha por forma habilitada.
- Exibir a soma deste pagamento, saldo após o lançamento e estado derivado Pagamento parcial ou Valor total. Usar valor em centavos; reaproveitar máscara e formatação locais.
- Mostrar a opção Fechar comanda quando o lançamento atual quitar exatamente o saldo. Se não for marcada, a comanda fica aberta com saldo zero e oferece Fechar comanda sem novo pagamento.
- Enviar com botão pendente, manter request_id e payload após resultado incerto, inclusive se o Sheet for fechado ou a página recarregada, mostrar erro acionável e permitir reenvio idempotente; após sucesso atualizar o cartão e os totais.
- No cartão encerrado, exibir horário de encerramento e pagamentos divididos por forma/valor; expandir continua mostrando itens e totais da comanda.
- Sinalizar que é lançamento manual. Não apresentar selo ou texto que sugira confirmação por adquirente.

## Persistência e segurança

- A coluna enabled_payment_methods de restaurants guarda a seleção de métodos e recebe as seis opções por padrão, inclusive para restaurantes existentes. Atualizações são feitas por RPC autenticada.
- A comanda admite status open/closed com closed_at e closed_by; o índice único de comanda aberta por mesa continua parcial para status open.
- comanda_payments guarda o evento, request_id, total, membro e horário; comanda_payment_splits guarda as linhas por método e valor, com chaves compostas que mantêm o mesmo restaurante.
- Leituras seguem RLS de membership ativa. Escritas de pagamento, fechamento e configuração são feitas por RPCs SECURITY DEFINER com search_path vazio; gravações diretas ficam revogadas.
- RPC de pagamento compara o request id, bloqueia comanda, reconta pedidos e pagamentos, rejeita excesso e grava pagamento e fechamento na mesma transação. Uma RPC distinta fecha depois uma comanda já quitada.
- Os eventos de comanda e pagamento usam o tópico Realtime privado existente e o Caixa atualiza por router.refresh.

## Direção visual e acessibilidade

- Continuar os componentes locais, Motion, cores e formas do Painel; não introduzir dependências.
- Entrada sequencial curta para linhas e cartões, sem animar todo o conteúdo; suportar prefers-reduced-motion.
- Usar labels persistentes, erros associados aos controles, foco visível, botões de pelo menos 44 px e feedback de carregamento/sucesso/erro.
- No celular, manter o resumo do saldo e a ação principal acessíveis sem ocultar os campos roláveis ou a área segura.

## Restrições do projeto

- Implementar no checkout atual, usando as convenções locais de Next.js e Supabase.
- Não instalar dependências.
- Não criar nem executar testes. Não executar git, typecheck, build ou lint.
- Revisar estaticamente SQL, contratos de dados, autorização, estados de UI e consistência entre os fluxos.
