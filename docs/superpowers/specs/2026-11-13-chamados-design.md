# Chamados por mesa

**Data:** 2026-11-13  
**Status:** implementação no código concluída e revisada estaticamente; migration ainda precisa ser aplicada no Supabase.

## Intenção

Permitir que um cliente chame a equipe a partir do cardápio aberto pelo identificador da mesa, e permitir que qualquer membro ativo do restaurante veja, assuma e conclua esse chamado no painel. A mudança cobre somente atendimento: não inclui pedido, pagamento ou notificação push.

## Estado atual

- `menu_tags` guarda tokens públicos de 32 caracteres, número da mesa e estado ativo.
- `/t/[token]` resolve o identificador e redireciona ao slug, descartando o contexto da mesa.
- `/{slug}` carrega perfil e cardápio sem contexto de identificador.
- O painel usa `PanelAppShell`, uma barra lateral desktop e um dock móvel com um menu de navegação.
- `memberships.position` é informativo. A autorização de painel existente é baseada em uma associação ativa ao restaurante.
- Supabase Realtime já está habilitado no projeto. O app usa as chaves Supabase existentes e não tem infraestrutura ou configuração de rate limit para essa feature.

## Objetivos

1. Manter `/t/[token]` como entrada contextual: mostrar “Mesa N” e o botão de chamado no perfil/cardápio compartilhado.
2. Manter `/{slug}` como navegação pública normal, sem identificação de mesa nem botão de chamado.
3. Impedir mais de um chamado ativo por mesa. A solicitação é idempotente enquanto houver chamado pendente ou em atendimento.
4. Atualizar o estado do cliente e da equipe por realtime após solicitação, assunção e conclusão.
5. Dar a todos os membros ativos do restaurante acesso às ações de assumir e concluir, sem regra por cargo.
6. Mostrar o total de chamados pendentes na navegação desktop e móvel, e tocar som apenas em uma nova chegada.
7. Entregar estados completos de carregamento, vazio, erro, desconexão, envio e ação desabilitada, com o padrão visual do painel.

## Fora de escopo

Pedidos, pagamentos, eventos/histórico detalhado, transferência, push notifications, cadastro de papéis e uma configuração adicional de Supabase ou outro serviço.

## Abordagem escolhida

**Renderizar o identificador sem redirecionar.** `/t/[token]` resolve slug e número da mesa e renderiza `RestaurantPublicProfile` com contexto opcional. O slug continua sem contexto. Redirecionar para `/{slug}?tag={token}` mantém o token, mas mistura a navegação normal e a navegação por etiqueta na mesma URL. Passar só o número da mesa é inseguro porque ele é fácil de falsificar.

**Reutilizar Broadcast do banco.** O Tavvi original emite mudanças por trigger para um canal privado da equipe e um canal de estado por token para o cardápio. A migração nova cria os triggers e políticas de `realtime.messages`; não adiciona `service_calls` à publicação Postgres `supabase_realtime`. Assim não existe uma etapa manual no Dashboard.

## Estados e regras do chamado

- `pending`: aguardando a equipe.
- `in_progress`: um membro assumiu o atendimento; `claimed_by` e `claimed_at` registram essa ação.
- `resolved`: atendimento concluído; `resolved_by` e `resolved_at` registram quem concluiu.
- `pending` e `in_progress` são ativos. A mesa não pode abrir outro chamado nesses estados. Após `resolved`, o botão público pode ser usado novamente.
- Qualquer membro ativo do mesmo restaurante pode assumir e concluir. A assunção é serializada no banco; a identidade de quem assumiu fica registrada.
- Se houver chamado ativo para o identificador, trocar o número da mesa desse identificador retorna conflito até a conclusão do chamado.
- Desativar um identificador com chamado ativo também retorna conflito; isso mantém o canal privado do cliente válido até a conclusão.
- Uma solicitação repetida para mesa com chamado ativo retorna o chamado existente sem criar outra linha.
- Solicitações públicas aceitam apenas token ativo de restaurante ativo com cardápio publicado. Uma função estreita com `SECURITY DEFINER`, o token aleatório derivado de UUID v4 (122 bits aleatórios), o índice único por mesa e limite de 10 novas solicitações por identificador por hora formam a proteção mínima. Não adicionar `APP_SERVER_KEY` nem outro serviço de rate limit neste escopo.

## Realtime e sincronização

- Canal de equipe: `service_calls:{restaurant_id}`; somente membros ativos do restaurante podem lê-lo.
- Canal de cliente: `service_calls_guest:{public_token}`; somente o token de uma etiqueta ativa de restaurante ativo pode lê-lo. O evento do cliente contém apenas ID e estado do chamado.
- O estado inicial do cliente procura o chamado mais recente pelo restaurante e número da mesa, de modo que a resolução não dependa de um ID de tag antigo.
- Triggers de `INSERT` e mudança de `status` avisam esses canais. Falhas de Broadcast não revertem a gravação e geram warning; a interface ressincroniza ao assinar/reconectar e quando a página retorna ao primeiro plano.
- A contagem do painel inclui somente `pending`; o som toca somente em novo `INSERT` pendente, nunca no carregamento inicial ou ressincronização.
- O som fica ligado por padrão, pode ser desligado na central e é habilitado após a primeira interação com a página para respeitar o bloqueio de reprodução automática dos navegadores.

## Interface

- Central `/painel/chamados` com `PanelPageHeading`, cartões de resumo, abas “Aguardando” e “Em atendimento”, cartões de mesa e ação primária “Assumir chamado” ou “Concluir atendimento”. Não mostra resolvidos por padrão.
- Navegação desktop: item “Chamados” com badge numérico.
- Navegação móvel: badge também no item aberto e no controle “Navegar” fechado.
- Cardápio por identificador: superfície fixa e discreta que identifica a mesa; estados “Chamar equipe”, “Aguardando a equipe” e “Equipe está atendendo”. Fica desabilitada enquanto o status é desconhecido, uma solicitação está enviando, ou existe chamado ativo.
- Usar `PanelPageHeading`, componentes shadcn já instalados, ícones `react-icons/lu`, `motion/react`, animação sequencial existente e `prefers-reduced-motion`.
- Skeleton próprio da central; fila vazia; ausência de itens no filtro; erro de carregamento com nova tentativa; indicador de desconexão; feedback de conflito e ações em andamento.
- O erro de rota usa `retry`, conforme a documentação local do Next.js 16.4.2.

## Restrições

- Não alterar o baseline Supabase; adicionar uma migration incremental.
- Não criar novas dependências, variáveis de ambiente ou sessões de autenticação para o fluxo público.
- Escritas da equipe passam por funções SQL que verificam associação ativa. Cliente público não lê diretamente a tabela.
- O projeto proíbe executar Git, `typecheck`, `build`, `lint`, `test` e proíbe adicionar testes. A verificação desta entrega será revisão estática.
- Antes da alteração Next.js, foram consultados os guias locais de páginas e layouts, componentes Server/Client, Server Functions, erro e loading do Next 16.4.2.
