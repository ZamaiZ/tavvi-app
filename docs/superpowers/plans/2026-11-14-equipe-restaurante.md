# Equipe do restaurante — plano de implementação

> **Para quem implementar:** seguir `superpowers:executing-plans` tarefa por tarefa. As etapas usam caixas de seleção para acompanhamento.

**Objetivo:** adicionar gestão segura de equipe por convites vinculados a e-mail, com cargos, busca e paginação e uma interface responsiva para o restaurante.

**Arquitetura:** manter o convite de criação de restaurante separado e criar um domínio de convites de equipe com tokens de uso único. O cargo fica na membership, mas não muda permissões das áreas existentes. Apenas a alteração de cargo exige admin. A página usa os padrões de tabela, cards, menus, animação e estados já presentes no app.

**Stack:** Next.js 16.4.2 App Router, React 19, Supabase, PostgreSQL/RPC, Zod 4, shadcn/ui, TanStack Table 9 e `motion/react`.

**Design:** `docs/superpowers/specs/2026-11-14-equipe-restaurante-design.md`

## Restrições globais

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não criar nem executar testes automatizados.
- Manter `platform_invites` e o aceite de criação de restaurante funcionando sem mudança de comportamento.
- Exibir a equipe para memberships ativas; somente admin pode alterar o cargo de uma pessoa existente. Convites, revogações, novo link e remoção de outra pessoa ficam disponíveis para qualquer membro ativo.
- O token em texto claro aparece somente na resposta de criação/substituição e não é persistido.
- Usar cargos conhecidos `admin`, `cashier`, `attendant`, `waiter`; não adicionar editor de cargos customizados.
- Seguir os tokens existentes, `motion/react` e suporte a movimento reduzido.
- Link é compartilhado manualmente por cópia; não adicionar um provedor de e-mail.

## Arquivos e responsabilidades

- `supabase/migrations/20261114090000_panel_membership_roles.sql`: converte a membership atual para cargo explícito e garante admin no primeiro aceite de convite da plataforma.
- `supabase/migrations/20261114100000_panel_team_invites.sql`: cria `team_invites` e RPCs transacionais de equipe/convite.
- `features/panel/team/model.ts`: cargos, rótulos, DTOs, filtros, paginação e estados de equipe.
- `features/panel/team/schema.ts`: validação de convite, cargo, busca, filtro, paginação e ações.
- `features/panel/team/server/read.ts`: leitura de membros/convites e consulta paginada autenticada.
- `features/panel/team/server/write.ts`: adaptadores de criação, substituição, revogação, alteração de cargo e remoção.
- `features/panel/team/server/redemption.ts` e `server/token.ts`: prévia, validação de e-mail, resgate e tokens hash-only do convite da equipe.
- `features/panel/team/actions.ts`: Server Actions validadas que encaminham para `server/read` e `server/write`.
- `features/panel/team/components/team-page.tsx`: interação da página, filtros, busca e atualização de URL.
- `features/panel/team/components/team-data-table.tsx`: DataTable desktop, cards mobile, linhas clicáveis e menus equivalentes.
- `features/panel/team/components/team-invite-dialog.tsx`: formulário de e-mail/cargo e apresentação do link recém-gerado.
- `features/panel/team/components/team-member-sheet.tsx`: detalhes e edição de cargo para admin.
- `features/panel/team/components/team-invite-redemption-page.tsx`: cadastro/aceite do convite de equipe vinculado ao e-mail.
- `features/panel/team/components/team-page-skeleton.tsx`: skeleton responsivo correspondente à página.
- `app/painel/(workspace)/equipe/page.tsx`: leitura inicial no Server Component, validação dos parâmetros e entrega de dados à feature.
- `app/painel/(workspace)/equipe/loading.tsx`: loading da rota usando o skeleton da feature.
- `features/panel/invites/model.ts`, `actions.ts`, `server/redemption.ts`, `components/invite-redemption-page.tsx` e `app/painel/convite/page.tsx`: ampliar o fluxo de aceite com uma variante discriminada de convite de equipe, sem alterar o resultado do convite de plataforma.
- `features/panel/shell/components/panel-app-shell.tsx` e `features/panel/shell/components/panel-mobile-dock.tsx`: adicionar acesso à página Equipe sem esconder outras áreas por cargo.

## Pontos de revisão

- Conta existente com e-mail diferente do convite: o aceite é recusado no RPC e não cria/reactiva membership (Tasks 2 e 4).
- Convite vencido, revogado, já utilizado ou token desconhecido: a resposta externa não revela qual condição falhou (Tasks 2 e 4).
- Convite para membro removido: aceite reativa a membership única e aplica o novo cargo sem duplicar associação (Task 2).
- Tentativas simultâneas de rebaixar/remover administradores: a transação preserva pelo menos um admin (Task 2).
- Tentativa de colaborador chamar uma Server Action ou RPC de alteração de cargo diretamente: o banco recusa (Task 2).
- Clique em botão/menu de linha: não abre também o detalhe da linha (Task 6).
- Busca/filtro/página mudam juntos: URL, contagem e linhas permanecem alinhadas (Task 5).
- Estados sem resultados, primeiro acesso, convite pendente, erro e movimento reduzido continuam compreensíveis em desktop e mobile (Tasks 5 e 6).

---

### Tarefa 1: Cargo canônico e helpers de autorização

**Arquivos:**

- Criar: `supabase/migrations/20261114090000_panel_membership_roles.sql`
- Consultar para preservar o aceite atual: `supabase/migrations/20261029010000_platform_invites.sql` e `supabase/migrations/20261030010000_check_panel_invite_restaurant_name.sql`.

- [x] Adicionar `memberships.role`, manter `position` legado para compatibilidade, gravar `admin` nas memberships existentes e aplicar `CHECK` com `admin`, `cashier`, `attendant` e `waiter`.
- [x] Criar helper `panel_is_restaurant_admin(uuid)` com `SECURITY DEFINER`, `search_path` vazio, grants mínimos e checagem de membership ativa.
- [x] Manter o RPC atual de aceite de convite da plataforma: o novo `role` tem default `admin`, então o primeiro responsável continua admin sem alterar o fluxo existente.
- [x] Conferir que o helper não permite associação removida, outro restaurante ou cargo informado pelo cliente como prova de autorização.

### Tarefa 2: Ciclo transacional de equipe no banco

**Arquivos:**

- Criar: `supabase/migrations/20261114100000_panel_team_invites.sql`
- Usar: helpers de `20261114090000_panel_membership_roles.sql`.

- [x] Criar `team_invites` com restaurante, e-mail normalizado obrigatório, cargo, hash do token, criador, criação, validade, aceite e revogação; aplicar checks e índices para busca por restaurante/e-mail e token único.
- [x] Criar RPCs de listagem paginada, criação/substituição, revogação, pré-visualização e aceite. Validar membership ativa na listagem e nas operações de equipe; exigir admin somente para alteração do cargo de uma pessoa existente. Auditar alterações na mesma transação.
- [x] No aceite, validar token ativo e e-mail autenticado; inserir ou reativar membership com o cargo guardado no convite e marcar o convite como usado atomicamente.
- [x] Implementar alteração de cargo e remoção lógica; serializar mudanças pelo restaurante e recusar auto-rebaixamento ou remoção do último admin no banco.
- [x] Garantir que convite repetido/indisponível devolva conflito tratável e não crie múltiplas memberships ou convites simultâneos para o mesmo e-mail.
- [x] Conferir integridade das constraints, grants, estados do convite, expiração e invariantes transacionais por inspeção da migration.

### Tarefa 3: Preservar acesso atual e ligar a navegação da equipe

**Arquivos:**

- Modificar: `features/panel/shell/components/panel-app-shell.tsx` e `features/panel/shell/components/panel-mobile-dock.tsx`.

- [x] Adicionar **Equipe** à navegação desktop e mobile para memberships ativas.
- [x] Não adicionar checagem de cargo a cardápio, identificadores, identidade, contato, feedback, chamados ou demais áreas existentes.
- [x] Revisar que `role` só define a autorização para editar o cargo de uma pessoa existente e não restringe as outras operações da equipe nem as áreas existentes.

### Tarefa 4: Camada de equipe e aceite vinculado ao e-mail

**Arquivos:**

- Criar os arquivos `features/panel/team/model.ts`, `schema.ts`, `server/read.ts`, `server/write.ts` e `actions.ts`.
- Modificar: `features/panel/invites/model.ts`, `actions.ts`, `server/redemption.ts`, `components/invite-redemption-page.tsx` e `app/painel/convite/page.tsx`.
- Reutilizar: `lib/routing/panel.ts` para montar link sob o host/base path configurado.

- [x] Definir `TeamRole`, rótulos em português, filtros `all | active | pending`, DTO discriminado para membro e convite, query com busca/página/tamanho e result com contagens.
- [x] Validar e-mail obrigatório com trim/lowercase, cargo permitido, busca limitada a 254 caracteres, página >= 1 e tamanho máximo 100; usar 25 linhas por página por padrão.
- [x] Implementar leitura server-side via RPC paginado, ordenação estável por data e identificador, e mapeamento explícito do retorno do banco para DTO.
- [x] Implementar Server Actions com validação de entrada, códigos de falha normalizados, revalidação da rota e tratamento de autorização.
- [x] Adicionar ao convite atual uma prévia discriminada `platform | team`; o preview de equipe informa restaurante/cargo sem expor token ou e-mail completo.
- [x] Discriminar também a entrada de aceite: `platform` mantém nome do restaurante e o fluxo atual; `team` não pede nome de restaurante e chama o aceite do convite de equipe.
- [x] Para signup, fixar o e-mail indicado pelo convite e verificar a correspondência antes de criar conta. Para sessão existente, deixar o RPC comparar o e-mail Auth no aceite.
- [x] No aceite de equipe, definir o restaurante convidante como ativo e seguir o fluxo de destino já usado no aceite de convite de plataforma.
- [x] Preservar integralmente o comportamento do convite de plataforma, inclusive criação de restaurante, tela de nome e tratamento de confirmação por e-mail.

### Tarefa 5: Rota e busca/paginação da equipe

**Arquivos:**

- Criar: `app/painel/(workspace)/equipe/page.tsx`
- Criar: `app/painel/(workspace)/equipe/loading.tsx`
- Criar: `features/panel/team/components/team-page.tsx`
- Criar: `features/panel/team/components/team-page-skeleton.tsx`
- Criar: `app/painel/(workspace)/equipe/error.tsx`
- Referências visuais: `features/admin/invites/components/admin-invites-page.tsx`, `invites-table-toolbar.tsx`, `invites-data-table.tsx` e `admin-invites-page-skeleton.tsx`.

- [x] Implementar leitura inicial no Server Component para membership ativa, validar `search`, `status`, `page` e `pageSize` com Zod e consultar membros/convites em servidor.
- [x] Construir cabeçalho com hierarquia visual do Painel, resumo de ativos/pendentes, ícone, descrição objetiva e botão **Convidar pessoa**.
- [x] Implementar busca por nome/e-mail, filtros com contagens, paginação e sincronização de filtros/página com parâmetros de URL.
- [x] Implementar empty state inicial distinto de busca vazia; permitir limpar busca/filtro sem perder o contexto do restaurante.
- [x] Criar skeleton que acompanhe cabeçalho, métricas, busca/filtros, tabela desktop e cards mobile; usar sequência de entrada e `useReducedMotion`.

### Tarefa 6: DataTable, menus e fluxo de convite

**Arquivos:**

- Criar: `features/panel/team/components/team-data-table.tsx` (inclui os cards mobile)
- Criar: `features/panel/team/components/team-invite-dialog.tsx`
- Criar: `features/panel/team/components/team-member-sheet.tsx`
- Modificar: `features/panel/team/components/team-page.tsx`

- [x] Renderizar tabela shadcn/TanStack no desktop com colunas Pessoa, Cargo, Estado, Entrada/validade e Ações.
- [x] Fazer clique e ativação por teclado na linha/cartão abrirem detalhe. Separar eventos de botões e menus para que ação não dispare abertura do detalhe.
- [x] Adicionar `ContextMenu` por clique direito/toque longo e `DropdownMenu` de reticências para acesso por clique esquerdo. Oferecer ações conforme tipo de registro e permissão.
- [x] Criar cards mobile com avatar/iniciais, e-mail, cargo, estado e data; manter menu contextual e botão de ações sem sacrificar a área de toque.
- [x] Criar convite com e-mail obrigatório, cargo selecionável e validade padrão de 7 dias; após sucesso mostrar link, botão copiar e fallback de seleção manual. Não voltar a exibir token em detalhes/listagens.
- [x] Permitir que qualquer membro ativo substitua link pendente (revoga o anterior e cria token novo), revogue convite, copie e-mail e remova o acesso de outra pessoa. Não persistir URL/token em banco.
- [x] Permitir somente a admin alterar o cargo de uma pessoa existente; bloquear auto-rebaixamento e remoção do próprio acesso, e preservar pelo menos um admin ativo no banco.
- [x] Dar feedback de sucesso/erro, busy por linha/formulário, estado de cópia, falha de clipboard, conflito de convite pendente e sessão/contexto expirado.
- [x] Aplicar entrada sequencial discreta e transições de hover/press dos padrões existentes, respeitando movimento reduzido e foco visível.

## Revisão estática final

- Conferir alinhamento entre cargo mostrado e cargo salvo; verificar que somente a alteração de cargo existente exige admin e as demais operações aceitam qualquer membership ativa.
- Conferir que memberships antigas e o primeiro cadastro da plataforma entram como admin.
- Conferir que o convite de equipe não pode aceitar e-mail diferente nem duplicar membership.
- Conferir proteção do último admin e status `removed` nas ações de equipe.
- Conferir que as funcionalidades existentes continuam disponíveis para qualquer membership ativa, sem autorização por cargo.
- Conferir DataTable, menu contextual, abertura de detalhes, busca/filtros/paginação, estados vazios, skeleton e layouts mobile/desktop por inspeção dos componentes.
- Não instalar dependências nem executar comandos proibidos; o projeto instrui a não trabalhar com testes automatizados.
