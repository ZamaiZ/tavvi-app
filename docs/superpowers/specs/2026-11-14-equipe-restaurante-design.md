# Equipe do restaurante — proposta de design

**Status:** implementado; revisão estática concluída.
**Escopo:** associação de pessoas a restaurantes por convite, cargos e gestão de acessos no Painel.

## Intenção

Permitir que membros ativos convidem colaboradores por e-mail, atribuam um cargo e acompanhem membros e convites numa página de equipe responsiva. O link só pode ser aceito por uma conta autenticada com o mesmo e-mail indicado no convite.

## Estado encontrado

- Esta base não tem rota nem feature de equipe. O fluxo atual de convite, em `features/panel/invites`, é para criar um restaurante a partir de um convite da plataforma.
- A primeira associação de um restaurante é gravada como `position = 'Administrador'` em `supabase/migrations/20261029010000_platform_invites.sql`.
- `memberships.position` está documentado no banco como informativo, sem efeito de autorização. As áreas existentes usam membership ativa para conceder acesso. Nesta entrega, todos os cargos mantêm esse mesmo acesso; cargo não vira matriz de permissões.
- O Tavvi original já tem criação e resgate de convites, troca de cargo, remoção e proteção contra remover ou rebaixar o último administrador. A implementação nova deve conservar essas invariantes e seguir a arquitetura atual, que usa `features/panel`, Server Components, ações/RPCs e componentes shadcn.
- A lista de convites administrativos atual estabelece o padrão de busca, filtros, paginação, menus, cards mobile, animações e skeletons. A rota atual de convite gera e mostra um link para copiar; não há envio transacional de e-mail implementado.

## Abordagens

1. **Ampliar `platform_invites` para convites de plataforma e de equipe.** Reaproveitaria uma tabela, mas misturaria dois ciclos distintos: um cria um restaurante e o outro associa uma conta a um restaurante existente. Isso aumentaria o risco de regressão no convite de cadastro e dificultaria as regras próprias de cada fluxo.
2. **Criar um domínio de convite de equipe separado e reutilizar o padrão visual de convites existente — recomendada.** Adiciona cargo à membership, tabela `team_invites` e operações transacionais próprias. Mantém o convite de criação de restaurante intacto e permite uma prévia discriminada no fluxo comum de aceite.
3. **Criar cargos livres e uma matriz de permissões editável agora.** É mais flexível, mas exige uma interface de criação de cargos e definição de permissões, além de aplicar essas permissões a cada rota, ação, RPC e política de armazenamento. É um projeto maior que a gestão de equipe solicitada.

**Escolha:** abordagem 2, com cargos conhecidos (`admin`, `cashier`, `attendant`, `waiter`). O cargo é informativo para todos os fluxos existentes; somente a alteração do cargo de uma pessoa exige admin. Novos cargos entram pelo catálogo do produto, sem uma matriz de permissões nesta entrega.

## Modelo de acesso proposto

| Cargo | Acesso nesta base |
| --- | --- |
| Administrador, Caixa, Atendente e Garçom | Mantêm o acesso atual de qualquer membership ativa a todas as áreas e ações existentes. Somente a alteração do cargo de um membro é exclusiva do admin. |

O cargo não se torna uma matriz de permissões para o produto. Não serão alteradas autorizações de cardápio, chamados, identificadores, perfil, contato ou feedback. Qualquer membro ativo pode convidar, revogar/substituir convites e remover o acesso de outra pessoa. Somente admin pode alterar o cargo de uma pessoa que já entrou na equipe.

## Fluxo proposto

1. Um membro ativo abre **Equipe**, escolhe **Convidar pessoa**, informa e-mail obrigatório e cargo.
2. O servidor normaliza o e-mail, valida o cargo e a membership ativa, cria um token aleatório de uso único e persiste somente o hash. O convite vence em 7 dias por padrão, seguindo o fluxo atual.
3. A confirmação mostra o link uma única vez, com copiar e alternativa de seleção manual. O membro compartilha o link fora do Tavvi. Um convite pendente pode ser revogado ou substituído por um novo link; o token anterior deixa de funcionar.
4. O link abre a prévia de convite. A pessoa cria uma conta ou entra com a existente. O aceite no banco compara o e-mail autenticado com o e-mail normalizado do convite e, na mesma transação, ativa a membership com o cargo salvo no convite.
5. A pessoa passa a acessar o restaurante convidante. Convite expirado, revogado, usado, com token inválido ou e-mail divergente não cria membership.

## Página de equipe

- Cabeçalho alinhado a `PanelPageHeading`, com ação principal **Convidar pessoa** e resumo de membros ativos e convites pendentes.
- Busca por nome/e-mail, filtro por estado, paginação estável controlada pela URL e contagem dos resultados.
- Uma DataTable desktop exibe membros ativos e convites pendentes com pessoa/e-mail, cargo, estado, data de entrada ou validade e ações.
- Clique na linha abre detalhes. Clique direito abre `ContextMenu`; botão de reticências abre as mesmas ações por clique esquerdo, conforme o padrão combinado de tabela e menus usado nas features atuais.
- No mobile, cards mostram as mesmas informações. Tocar no card abre detalhes; toque longo e botão de reticências expõem o menu de ações.
- A equipe pode ser consultada e gerenciada por qualquer membro ativo: convites, revogações, substituição de link e remoção de outra pessoa. Somente admin pode mudar o cargo de uma pessoa existente; a proteção também existe no banco. A remoção do próprio acesso não é oferecida nesta tela.
- A remoção muda a membership para `removed`, preservando o histórico e respeitando a chave única existente. Um novo convite ao mesmo e-mail reativa essa linha com o cargo do novo convite.
- Carregamento, estado vazio inicial, busca sem resultados, filtros vazios, convite pendente, operação em andamento e falhas recebem estados próprios. Entrada sequencial usa `motion/react` e respeita movimento reduzido.

## Dados e segurança

- Uma migration adiciona `memberships.role`, converte as memberships existentes para `admin` e mantém `position` somente para compatibilidade com o aceite atual de convite da plataforma. Outra migration cria o ciclo de equipe sem alterar migrations históricas.
- `team_invites` guarda restaurante, e-mail obrigatório normalizado, cargo, hash do token, autor, criação, validade, resgate e revogação. O link em texto claro nunca é persistido.
- RPCs restritos validam membership ativa para consulta e para operações de equipe; somente a alteração do cargo de uma pessoa existente exige admin. Convite, aceite, revogação/substituição, alteração de cargo e remoção são transacionais com auditoria.
- A troca ou remoção do último administrador é recusada dentro de transação serializada pelo restaurante, evitando que duas operações simultâneas deixem a equipe sem responsável.
- Todas as áreas e operações existentes continuam disponíveis a qualquer membership ativa, sem filtragem por cargo. Só a mudança de cargo é exclusiva do administrador.
- A interface de convite continua com link copiável, igual ao fluxo atual. Envio automático de e-mail fica fora desta proposta porque não há serviço transacional configurado nesta base.

## Fora de escopo

- Criador visual de cargos ou permissões personalizadas.
- Integração com provedor para envio automático de e-mail.
- Módulo financeiro para Caixa.
- Convites sem e-mail, acesso aberto ou transferência de restaurante.
- Exclusão física de memberships ou exposição de token em listagens.

## Critérios de aceite

- Toda membership existente passa a ser administradora, e novas memberships criadas pelo convite de plataforma também são administradoras.
- Convite de equipe exige e-mail e cargo; conta com e-mail diferente nunca é vinculada.
- O cargo é aplicado atomicamente no aceite. Qualquer membro ativo pode emitir convites e escolher o cargo inicial; somente admin pode alterar o cargo de uma pessoa que já entrou.
- Todas as memberships ativas preservam o acesso atual ao produto e podem executar as operações da equipe, exceto a alteração de cargo existente, exclusiva do admin.
- A equipe tem busca, filtro, paginação, DataTable desktop, cards mobile, clique para abrir detalhes e menus contextuais nos dois formatos.
- A experiência cobre estados de carregamento, vazio, erro, operação pendente e movimento reduzido.
- O convite de plataforma existente continua criando restaurantes e memberships admin.

## Premissas para revisão

- Esta proposta interpreta “pode criar outros” como adicionar cargos conhecidos ao catálogo, não criar permissões customizadas pela interface.
- Esta proposta interpreta “envia o link” como gerar e copiar/compartilhar manualmente. O Tavvi não envia e-mail transacional hoje.
- Caixa não ganha um módulo financeiro inexistente. Todos os cargos preservam o acesso atual às áreas do Painel.
