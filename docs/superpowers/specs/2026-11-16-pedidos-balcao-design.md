# Pedidos de balcão e comandas sem mesa

## Intenção

Permitir que a equipe registre pedidos feitos no caixa/balcão sem criar um chamado de mesa. O pedido usa o mesmo cardápio, configuração de itens, observações, acréscimos, preços confirmados no banco, pagamento e encerramento já usados pelas comandas atuais.

## Objetivos

- Criar um pedido direto no Caixa, sem `service_call_id` e sem inventar um chamado.
- Oferecer os modos **Comer no local** e **Para viagem**.
- Permitir informar uma mesa física em pedidos para comer no local, mesmo que ela não tenha identificador/tag. Nesse caso, reutilizar a comanda aberta da mesa ou abrir uma nova, como no fluxo atual.
- Quando não houver mesa, abrir uma comanda própria para aquele pedido e atribuir um número sequencial gerado pelo sistema. Um novo pedido sem mesa recebe outra comanda; comandas de balcão não são agrupadas por número informado.
- Permitir nome opcional para identificar o pedido.
- Registrar pagamento e encerrar pelo fluxo existente do Caixa; conservar histórico de comandas fechadas.
- Preservar o fluxo atual de chamados: pedido confirmado a partir de chamado continua validando o responsável e finalizando o chamado atomicamente.
- Manter layouts desktop e celular, estados de erro/reenvio, acessibilidade, movimento reduzido e animações sequenciais já usados no Painel.

## Fora de escopo

- Impressão de senha, tela de cozinha, notificações de preparo, emissão fiscal, integração de pagamento ou entrega com endereço.
- Mesclar pedidos de balcão sem mesa em uma comanda reutilizável.
- Alterar regras de pagamento, divisão de pagamento, saldo ou fechamento.
- Criar ou exigir uma entidade/cadastro separado para todas as mesas do restaurante.

## Abordagens consideradas

1. **Estender o domínio atual de comandas e pedidos (recomendada).** O pedido sem chamado continua sendo um `order` com `service_call_id = null`; comanda e pedido recebem os metadados necessários. A RPC mantém a transação, catálogo e integridade atuais, e o Caixa continua usando o mesmo ledger de pagamento.
2. **Criar uma entidade e um caminho de venda de balcão separados.** Evita flexibilizar comanda, mas duplica a gravação de itens e exige adaptar ou duplicar pagamentos, histórico e encerramento.
3. **Representar balcão como uma mesa/chamado fictícios.** Reaproveita parte da tela, mas cria vínculos falsos, pode colidir com mesas reais e faria o histórico de chamados conter eventos que nunca ocorreram.

A primeira abordagem preserva a unidade que já concentra saldo e pagamento: a comanda. A segunda acrescenta dois domínios para a mesma venda; a terceira distorce os dados e o fluxo de chamados.

## Regras de domínio propostas

- `comandas.table_number` passa a aceitar `null`; comandas existentes permanecem vinculadas a uma mesa.
- Pedidos originados em chamado continuam associados à mesa do chamado e têm modo `dine_in`.
- Pedidos diretos do Caixa não têm chamado. Se a equipe informar mesa, o modo é `dine_in` e o pedido entra na comanda aberta daquela mesa, sem verificar se existe tag. A restrição única atual por restaurante e mesa continua evitando duas comandas abertas para a mesma mesa.
- Pedido direto sem mesa cria uma comanda própria. Vale para comer no local sem mesa ou para viagem. Não é anexado a outra comanda de balcão.
- Cada pedido sem mesa recebe um número `display_number` sequencial, único por restaurante e nunca reutilizado; a contagem não reinicia automaticamente. Pedidos vinculados a mesa não precisam desse número.
- `customer_name` é opcional, limitado a 120 caracteres e salvo como snapshot do pedido. Dados de modo, número e nome também são snapshots operacionais e não dependem de alterações posteriores no restaurante.
- `takeaway` não aceita número de mesa. `dine_in` aceita mesa opcional.
- `service_call_id` continua nullable. Pedido sem chamado não altera `service_calls`; pedido com chamado continua sujeito ao gatilho que verifica restaurante, mesa, estado e responsável antes de finalizar o atendimento.
- A RPC de gravação segue como autoridade: membership ativa, restaurante esperado, chamado/responsável quando houver, contexto de atendimento, disponibilidade e preço do cardápio, quantidades, observações, acréscimos, snapshots e totais são validados ou calculados no banco.
- A operação é idempotente. Repetições com o mesmo `request_id` retornam o pedido original somente quando o contexto informado (modo, mesa, nome) e os itens enviados correspondem à solicitação original. O número gerado é devolvido do pedido já gravado; uma repetição nunca aloca outro. Reuso da chave com outro pedido retorna conflito.
- Pagamento integral/parcial e encerramento continuam vinculados ao `comanda_id`; pedidos sem mesa não criam regras próprias de pagamento.

## Fluxo e apresentação

Na página **Caixa**, uma ação primária **Novo pedido** abre um Sheet em tela cheia, reutilizando `OrderMenuCatalog`, `OrderItemComposer` e `OrderSummary` de `CallOrderDialog`.

```text
Caixa                         [Novo pedido]
  Abertas | Encerradas        Busca: mesa, número ou nome
  Mesa 12 · Aberta            R$ 86,00
  Balcão #042 · Para viagem   R$ 24,00

Novo pedido
  [Comer no local] [Para viagem]
  Mesa (opcional)             Nome (opcional)
  Cardápio                    Resumo fixo no desktop
                              Resumo inferior no celular
```

- **Comer no local:** seletor/campo numérico opcional de mesa e nome opcional. Sem mesa, o banco cria comanda de balcão numerada.
- **Para viagem:** nome opcional; não exibe seleção de mesa. O banco cria comanda de balcão numerada.
- O número gerado aparece na confirmação e nos cartões/detalhes da comanda. Comandas de mesa aparecem como `Mesa N`; comandas sem mesa mostram `Balcão #N`, modo e, quando disponível, nome.
- A busca do Caixa encontra mesa, número e nome. A lista aberta ordena mesas por número e pedidos de balcão por abertura mais recente; a lista encerrada mantém fechamento mais recente primeiro.
- A ação de pagamento informa o tipo e a referência da comanda, sem rotular todas como mesa.
- Animação em sequência para entrada de contexto, catálogo, resumo e cartões; manter tempos curtos, sem animar a interação de pagamento em si. Respeitar `prefers-reduced-motion`, foco visível, nomes acessíveis e áreas de toque existentes.

## Persistência e segurança

- Uma nova migração deve permitir mesa nula em `comandas` e adicionar ao pedido o modo, número de balcão e nome opcional. Registros existentes são migrados como `dine_in`, mantendo suas mesas.
- Criar contador transacional por restaurante para `display_number` e impor unicidade histórica por restaurante. A atribuição do número, criação/reuso da comanda, pedido, itens e acréscimos acontece na mesma RPC/transação.
- A RPC de pedido passa a aceitar os dois contextos: chamado em atendimento ou lançamento direto do Caixa. Para pedido direto, exige membro ativo, permite mesa sem tag e nunca escreve em `service_calls`.
- Manter gravações fora de RPC revogadas e RLS de leitura por membro ativo. Não confiar no cliente para totais, preço de catálogo, disponibilidade, número sequencial ou restaurante.
- Estender leitura/modelo do Caixa para aceitar `table_number` nulo e entregar os metadados do pedido aos cartões e ao diálogo de pagamento. Realtime continua usando o tópico atual de comandas.
- Atualizar validação do servidor, tipos e apresentação sem criar dependências.

## Escopo técnico provável

- Supabase: nova migração para campos, contador, índices/constraints e RPC de pedido.
- Pedidos: `model.ts`, `schema.ts`, `server/write.ts`, `server/read.ts`, ações e contrato RPC.
- Interface: novo editor de pedido do Caixa compartilhando os três componentes de catálogo/configuração/resumo; `cash-workspace.tsx`, `comanda-payment-dialog.tsx` e a rota `caixa/page.tsx`.
- A chamada existente deve continuar buscando catálogo e encerrando o chamado com seu mesmo contrato observável.

## Restrições e validação

- Stack atual: Next.js 16.4.2, React 19.3.1, Supabase, Base UI/shadcn local e Motion. Não instalar dependências.
- Antes de qualquer código, consultar o guia Next.js pertinente em `node_modules/next/dist/docs/`, como exige `AGENTS.md`.
- `AGENTS.md` proíbe `git`, `typecheck`, `build`, `lint` e testes; não adicionar nem executar testes. A revisão futura deve ser estática e visual, sem esses comandos.

## Decisões deixadas ao implementador

- Definir o formato visual do número sequencial sem reinício e comunicar claramente o número retornado pela gravação.
- Escolher a apresentação do campo de mesa (digitação numérica ou seleção com entrada manual), preservando a possibilidade de informar mesa ainda sem tag.
- Manter fallback/retry com o mesmo `request_id` quando a resposta da gravação for incerta; não permitir que uma resposta incerta perca o carrinho ou gere outro número.
