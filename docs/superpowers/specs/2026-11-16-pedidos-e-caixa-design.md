# Pedidos da Mesa e Caixa

> Esta especificação descreve pedidos e o primeiro Caixa. Pagamentos, configurações e encerramento foram detalhados posteriormente em [pagamentos e fechamento de comanda](2026-11-16-pagamentos-fechamento-comanda-design.md), que prevalece quando o assunto for liquidação e histórico de comandas.

## Intenção

Permitir que a equipe registre pedidos enquanto atende um chamado e consulte, no Caixa, as comandas abertas das mesas. O lançamento deve ser rápido no salão, funcionar bem em desktop e celular e preservar a diferença entre atendimento, pedido e comanda.

## Objetivos

- Abrir um diálogo que cubra a viewport inteira ao selecionar um chamado em atendimento.
- Mostrar o catálogo com a linguagem visual dos itens do Cardápio: mídia à esquerda, nome, categoria, descrição e preços. Itens com variações apresentam cada opção e seu preço para seleção explícita.
- Permitir quantidade, observações e acréscimos livres em campos distintos. Cada acréscimo tem nome, quantidade por unidade do item e preço unitário informado pela equipe; preço zero é permitido.
- Confirmar vários itens como um pedido associado ao chamado e à comanda aberta da mesa.
- Abrir a comanda no primeiro pedido confirmado e reutilizá-la nos pedidos seguintes da mesma mesa enquanto permanecer aberta.
- Criar a página Caixa, com comandas abertas, pedidos, itens e valores totais.
- Preservar estados de carregamento, vazio, erro, retry, indisponibilidade, salvamento e sucesso; usar animações sequenciais respeitando movimento reduzido.

## Fora de escopo

- Sessões de caixa, gorjetas, descontos, impressão e fluxo de cozinha. Pagamentos e fechamento são tratados na especificação posterior de pagamentos e fechamento de comanda.
- Cadastro persistente de adicionais no Cardápio. Os acréscimos desta etapa são descritos e precificados no próprio pedido.
- Criar uma comanda vazia quando alguém assume um chamado.
- Persistir rascunhos de pedido antes de confirmar.
- Concluir automaticamente o chamado ao confirmar um pedido.

## Abordagens consideradas

1. Guardar os itens diretamente no registro de chamados. Tem menor custo inicial, mas mistura ciclos diferentes, perde histórico independente de pedidos e não permite uma comanda compartilhada por chamados sequenciais.
2. Manter chamados, pedidos e comandas como entidades separadas, com uma transação de confirmação. Esta é a abordagem escolhida: corresponde à direção já registrada em __BASE.MD, permite várias confirmações por chamado e vários chamados na visita, e deixa o Caixa como consumidor do mesmo domínio.

## Regras de produto

- A fila mantém os estados atuais: aguardando, em atendimento e concluído.
- O botão de chamado aguardando continua assumindo o chamado. Um chamado em atendimento abre o editor de pedido. Concluir atendimento é uma ação separada dentro do editor.
- Só a pessoa atribuída ao chamado pode registrar pedidos e concluí-lo. Outros membros podem abrir o diálogo em modo de leitura e veem a orientação para procurar a pessoa responsável.
- Confirmar um pedido não conclui o chamado. Depois de confirmar, limpar o carrinho de trabalho e manter o diálogo aberto para permitir outro pedido no mesmo chamado.
- O catálogo mostra todas as categorias e todos os itens cadastrados. Categorias e itens ocultos, sem foto ou indisponíveis aparecem identificados e desabilitados; variações indisponíveis também continuam visíveis e desabilitadas.
- O modelo atual do Cardápio não tem um campo independente de medida. Quando uma variação representa tamanho ou volume, seu nome aparece junto ao respectivo preço; itens sem variações não recebem medida inventada.
- O filtro de categoria se combina com a busca, que pesquisa nome e descrição no cliente com debounce de 250 ms.
- A seleção de um item abre a configuração da linha: variação obrigatória quando aplicável, quantidade, observações e lista de acréscimos livres. Observações não alteram preço; acréscimos alteram o total.
- Valores de itens simples e variações são lidos e revalidados no banco na confirmação. O preço de acréscimos livres é submetido pelo membro responsável, validado como centavos não negativos e salvo como snapshot.
- Uma chave request_id única por restaurante torna a confirmação idempotente.
- Cada item e acréscimo confirma snapshots de nome, variação e preço. Alterações posteriores no Cardápio não reescrevem pedidos existentes.
- Uma comanda aberta é única por restaurante e número da mesa. A criação concorrente da primeira comanda é protegida por índice único e transação. Após encerrada, uma nova visita à mesa pode abrir outra comanda.
- O total é calculado a partir dos snapshots dos pedidos. A especificação posterior define pagamentos, saldo, fechamento e consulta de encerradas.

## Composição visual

### Chamados

- O card em atendimento é um alvo de botão acessível, com indicação de que abre pedido. O card aguardando mantém a ação de assumir; o card concluído permanece histórico.
- O diálogo usa o componente Dialog local com largura e altura de viewport, sem aplicar limites globais ao componente compartilhado.
- Cabeçalho fixo com mesa, estado do chamado, tempo em atendimento, botão de fechar e ação secundária para concluir atendimento quando o usuário é responsável.
- Barra superior do catálogo com pesquisa e tabs horizontais de categoria; a faixa pode deslizar por toque e teclado, sem scrollbar visível.
- Desktop: catálogo em coluna principal e resumo do pedido em painel lateral fixo. Celular: catálogo ocupa o espaço de rolagem e uma barra inferior fixa abre o resumo do pedido.
- A lista de produtos usa cartões horizontais inspirados no Cardápio: imagem/poster ou placeholder, categoria, nome, descrição, preço ou faixa/quantidade de variações e disponibilidade/visibilidade. O nome de cada variação aparece ao lado do preço.
- A configuração de item mostra mídia, nome, categoria, opções de variação com seus preços, stepper de quantidade, editor de acréscimos e observações.
- O resumo distingue produtos, variações, observações e acréscimos, com subtotal e botão fixo para confirmar.

### Caixa

- Página de operação com resumo compacto e cartões de comanda agrupados em grade responsiva.
- Cada cartão mostra mesa, horário de abertura, quantidade de pedidos/itens e subtotal; expandir revela itens, variações, quantidades, observações e acréscimos.
- Não apresentar controles financeiros ou estados que ainda não podem ser operados.
- Assinatura Realtime privada por restaurante atualiza a lista depois que um pedido é inserido.

### Movimento e acessibilidade

- Usar Motion já instalado, a cadência sequencial já usada no Painel e suporte a prefers-reduced-motion.
- Usar foco visível, nomes acessíveis para controles icon-only, alvos de toque de pelo menos 44 px e rolagem que não fique encoberta pelos elementos fixos.
- O Dialog mantém o gerenciamento de foco do Base UI. Tabs usam o componente local baseado em Base UI.

## Persistência e segurança

- Criar comandas, pedidos, itens e acréscimos em migração Supabase. Leituras exigem membership ativo via panel_menu_member; gravações acontecem apenas pela RPC autenticada.
- A RPC record_panel_order recebe restaurante esperado, chamado, request_id e itens; bloqueia o chamado, valida responsável e estado, revalida o Cardápio, cria/reutiliza a comanda e grava pedido/itens/acréscimos atomicamente.
- RLS permite somente leitura de membros ativos; insert/update/delete direto fica revogado para clientes. A RPC não confia no cliente para identidade, preço de catálogo, variação, total, disponibilidade ou vínculo entre restaurante e registros.
- Publicar eventos broadcast em tópico privado da comanda para refletir novos pedidos na página Caixa.
- A alteração da RPC de conclusão do chamado para conferir claimed_by mantém o ciclo alinhado à regra de atribuição.

## Estados e feedback

- Cardápio sem itens visíveis: mensagem contextual com link para o Cardápio. Itens sem foto aparecem com placeholder e não podem ser enviados.
- Busca vazia: resultado sem itens e ação para limpar busca/filtro.
- Item ou variação indisponível: visível e desabilitado; a gravação também revalida disponibilidade no banco.
- Confirmação inválida por mudança de preço/disponibilidade ou chamado encerrado: preservar carrinho, explicar o problema e oferecer sincronização/retry.
- Falha de conexão após uma resposta incerta: repetir a mesma request_id; nunca criar duplicata.
- Sucesso: mostrar confirmação da mesa e subtotal, atualizar a comanda e limpar só o carrinho confirmado.
- Caixa: skeleton na navegação, empty state sem comandas, alerta com retry se a lista falhar, estado de conexão e atualização após Realtime/reconexão.

## Restrições do projeto

- Stack existente: Next.js 16.4.2, React 19.3.1, Supabase e Base UI/shadcn local.
- Não instalar dependências novas.
- Não adicionar nem executar testes; AGENTS.md também proíbe git, typecheck, build e lint.
- O trabalho fica no checkout atual, conforme solicitado; a validação será revisão estática e inspeção visual manual se o ambiente local permitir.
