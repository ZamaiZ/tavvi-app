# Convites da plataforma — Plano de implementação

> **Para quem implementar:** siga `superpowers:executing-plans` tarefa por tarefa. Os passos usam caixas para registrar o andamento.

**Objetivo:** substituir convites de demonstração por uma fatia real ponta a ponta, segura e paginada: emissão pelo Admin, resgate no Painel, criação transacional de restaurante e confirmação factual.

**Arquitetura:** migrations definem convites, restaurantes, memberships, auditoria, RLS e RPCs transacionais. DAL server-only usa o Supabase SSR com a sessão do território correto; Server Actions validam e orquestram token/link; Server Components carregam a página Admin com busca, Tabs e paginação por URL. O resgate ocorre em `/painel/convite` (exposto como `/convite` em `painel.localhost`), usa a sessão `panel` e termina em confirmação factual após criar o restaurante nomeado em `draft`.

**Tecnologias:** Next.js 16.4.2 App Router, React 19, Supabase Auth/SSR/Postgres, RLS, RPC PostgreSQL, Zod, TanStack Table, shadcn preset, Tailwind e `motion/react`.

**Spec:** `docs/superpowers/specs/2026-10-29-platform-invites-functional-design.md`

## Restrições globais

- Não executar `git`, `test`, `typecheck`, `build` ou `lint`; não adicionar testes.
- Criar migration nova no `tavvi-app`; não reescrever/aplicar a baseline do app legado nem migrar dados de lá.
- E-mail do convite é opcional; validade entre 1 e 30 dias, padrão 7.
- Token: 32 bytes CSPRNG, Base64URL de 43 caracteres; armazenar somente SHA-256 em `bytea`.
- Autorização e integridade são verificadas no Postgres; nenhuma chave `service_role` vai ao browser.
- Pesquisa, status, contagens e paginação são do servidor; página padrão de 25 registros e limite de 100.
- A criação do restaurante exige apenas seu nome; resgate cria `draft` e membership na mesma transação do consumo e auditoria.
- A confirmação final descreve só o estado persistido e não segue para `/identidade`.
- Manter Motion sequencial, transições de ação e `prefers-reduced-motion`; preservar o shell e o Sidebar existentes.
- Não adicionar fixtures, valores de demonstração, links fictícios ou CSS de feature.

## Foco da revisão

- E-mail restrito divergente: aceite deve falhar sem consumir o convite.
- Duas aceitações simultâneas: apenas uma transação cria restaurante/membership e resgata o convite.
- Reenvio da mesma chave de idempotência: não cria outra linha e não recupera/revela um token já perdido.
- Expiração ou revogação concorrente com aceite: status calculado no banco e lock transacional impedem resgate inválido.
- Exclusão do usuário Admin: `created_by` e auditoria usam `ON DELETE SET NULL`; histórico sobrevive e não bloqueia a vaga Admin.
- Collision de slug: índice único do banco é a autoridade; o resgate inteiro falha sem consumir o convite.

---

### Tarefa 1: Schema, políticas e operações transacionais

**Arquivos:**

- Criar `supabase/migrations/20261029010000_platform_invites.sql`.

**Interfaces que entrega:**

- `platform_invites`: `id`, `email`, `token_hash`, `created_by`, `created_at`, `expires_at`, `redeemed_at`, `redeemed_by`, `restaurant_id`, `revoked_at`, `supersedes_invite_id` e `idempotency_key`.
- `restaurants`: identidade mínima real (`name`, `slug`), `status` (`draft | active | suspended`) e timestamps.
- `memberships`: usuário, restaurante, `position` informativo com valor inicial `Administrador`, estado e unicidade `(restaurant_id, user_id)`; `position` nunca é permissão.
- `audit_log`: ator anulável, ação, alvo e metadata sem token/e-mail de credencial; ator com `ON DELETE SET NULL`.
- `platform_invite_rate_limits`: janelas atômicas por convite válido ou usuário autenticado; 60 previews/convite, 5 aceites/usuário e 20 mutações Admin/usuário a cada 5 minutos.
- RPCs `list_platform_invites`, `create_platform_invite`, `replace_platform_invite`, `revoke_platform_invite`, `preview_platform_invite`, `check_platform_invite_email` e `accept_platform_invite`.
- Listagem retorna uma resposta JSON estreita: página de linhas, contagem global por status e total filtrado; nada contém `token_hash`.

- [x] Criar tabelas, checks, índices para hash único, ordenação, busca por e-mail, idempotência, membership e relacionamentos; não inserir seed.
- [x] Implementar contador de rate limit com lock/upsert transacional; tokens desconhecidos só fazem lookup pelo índice e não geram linhas de contador.
- [x] Habilitar RLS e remover grants de escrita direta; membros consultam apenas associações próprias, Admins só acessam os dados de plataforma por RPCs autorizadas.
- [x] Definir funções privilegiadas como `SECURITY DEFINER`, `search_path = ''`, objetos qualificados, validação estrita e autorização baseada somente em `auth.uid()`/`is_platform_admin()`.
- [x] Fazer create/replace/revoke e aceite gravarem suas auditorias dentro da própria função/transação.
- [x] No aceite, bloquear a linha do convite, conferir validade/revogação/uso/e-mail, validar disponibilidade de nome/slug, inserir restaurante `draft` e primeira membership com `position = 'Administrador'`, marcar resgate e auditar; qualquer falha reverte tudo.
- [x] No preview público, retornar estado genérico e prazo; não consumir, não retornar token, hash ou e-mail completo.
- [x] Aplicar os limites fixos documentados na spec no banco; o cadastro/login usa adicionalmente os limites configurados pelo Supabase Auth.
- [x] Conceder `EXECUTE` só a `anon`/`authenticated` nas funções públicas estritamente necessárias e só a `authenticated` nas operações Admin.
- [x] Fazer revisão estática do SQL: FKs de exclusão, status derivado, locks, grants/RLS, constraints e caminhos de erro transacional.

### Tarefa 2: Contratos, DAL e Server Actions do Admin

**Arquivos:**

- Criar `features/admin/invites/model.ts` e `features/admin/invites/schema.ts`.
- Criar `features/admin/invites/server/invites.ts` e `features/admin/invites/server/token.ts`.
- Criar `features/admin/invites/actions.ts`.
- Criar `lib/routing/panel.ts` e atualizar `.env.example`.

**Interfaces que entrega:**

```ts
type InviteListQuery = {
  search: string
  status: InviteFilter
  page: number
  pageSize: number
}

type InviteListResult = {
  rows: PlatformInvite[]
  counts: Record<InviteFilter, number>
  page: number
  pageSize: number
  totalRows: number
}

listPlatformInvites(query: InviteListQuery): Promise<InviteListResult>
createPlatformInvite(input: CreateInviteInput): Promise<CreateInviteResult>
replacePlatformInvite(input: ReplaceInviteInput): Promise<ReplaceInviteResult>
revokePlatformInvite(inviteId: string): Promise<InviteMutationResult>
```

- [x] Definir DTOs que nunca incluam token hash ou credenciais; validar resposta JSON da RPC antes de entregá-la à UI.
- [x] Definir Zod server-side para e-mail normalizado opcional, prazo inteiro 1–30, status, IDs, consulta/página e chave UUID de idempotência.
- [x] Implementar geração com `node:crypto` (`randomBytes(32)`, Base64URL e SHA-256); enviar ao banco somente digest em hexadecimal e nunca registrar token.
- [x] Validar `TAVVI_PANEL_BASE_URL` no servidor como URL HTTP(S) sem usuário, query ou fragmento; compor o link `/convite?token=...` preservando o prefixo `/painel` do Preview. Adicionar no `.env.example` um valor local não secreto para `http://painel.localhost:3000`.
- [x] Implementar DAL `server-only` usando `createSupabaseServerClient("admin")` e RPCs. Cada RPC é a barreira final de autorização; nenhum dado vai por client Supabase privilegiado.
- [x] Implementar Server Actions finas que validam, geram token/idempotência, chamam DAL e retornam apenas DTOs/resultado de link em memória.
- [x] Se uma repetição idempotente encontrar o convite sem poder recuperar token claro, retornar `link-unavailable`; oferecer rotação explícita, sem criar linha duplicada nem afirmar que o link anterior foi entregue.
- [x] Manter erros em códigos estáveis e mensagens seguras; revisar cada Action como endpoint POST público não confiável segundo a documentação local do Next 16.

### Tarefa 3: Listagem Admin real, filtros e estados

**Arquivos:**

- Modificar `app/admin/page.tsx` e criar um skeleton com `Suspense` restrito à página de convites (o `loading.tsx` no segmento Admin também envolveria as rotas de login/cadastro).
- Modificar `features/admin/invites/components/admin-invites-page.tsx`.
- Modificar `features/admin/invites/components/invites-table-toolbar.tsx` e `features/admin/invites/components/invites-data-table.tsx`.
- Substituir fixtures e contagens em `features/admin/invites/data.ts` por tipos/formatadores de domínio, ou removê-lo se as responsabilidades forem cobertas por `model.ts`.

**Interfaces que consome:** `InviteListQuery`, `InviteListResult`, `listPlatformInvites` da Tarefa 2.

- [x] Ler `searchParams` de forma assíncrona conforme Next 16, validar parâmetros e carregar uma página via uma única RPC.
- [x] Usar a RPC também como decisão de acesso Admin: não fazer consulta `is_platform_admin()` duplicada antes da leitura; erro de autorização redireciona a `/entrar`, indisponibilidade mostra estado de serviço.
- [x] Manter query/status/página na URL; debounce da pesquisa, reset para página 1 ao alterar busca/Tabs e ordenação determinística do banco.
- [x] Configurar TanStack Table para paginação manual com 25 linhas por página, total filtrado e controles acessíveis; os cards usam contagens globais, nunca a página visível.
- [x] Preservar seleção de Tabs mutuamente exclusiva e clique de linha para abrir detalhes; contexto por botão direito e ações de linha continuam disponíveis.
- [x] Remover `demoInvites`, contagens fixas e qualquer linha inventada; sem registros reais, exibir empty state com ícone, Motion e ação de criar; empty filtrado oferece limpar filtros.
- [x] Construir skeleton de métricas/tabela e estado de erro recuperável; filtros e navegação preservam linhas enquanto o RSC atualiza e mostram indicador discreto.
- [x] Manter as animações existentes e animar entradas sequencialmente, mudanças de linhas, seleção e feedback; respeitar `useReducedMotion`/`MotionConfig`.
- [x] Revisar por leitura: nenhum erro de RPC deve virar tabela vazia e nenhuma consulta de lista carrega o histórico completo no browser.

### Tarefa 4: Emissão, substituição e revogação na interface

**Arquivos:**

- Modificar `features/admin/invites/components/invite-create-sheet.tsx` e `features/admin/invites/components/invite-details-sheet.tsx`.
- Modificar `features/admin/invites/components/invites-data-table.tsx` e `features/admin/invites/components/admin-invites-page.tsx`.

**Interfaces que consome:** Actions da Tarefa 2 e lista RSC da Tarefa 3.

- [x] Criar convite real pelo Server Action; desabilitar submissão duplicada; exibir o link retornado uma única vez e feedback copiar/copied/error.
- [x] Preservar e-mail opcional, validade padrão 7 dias e confirmação ao fechar/descartar link ainda não copiado.
- [x] No detalhe, oferecer rotação/substituição somente conforme status permitido; editar e-mail/prazo cria substituição e invalida o anterior; exibir novo link só na resposta corrente.
- [x] Adicionar revogação de convite pendente com confirmação e feedback; expirado/resgatado/revogado não pode ser revogado como se pendente fosse.
- [x] Retornar DTO de mutação e revalidar apenas `/admin` na mesma Server Action, para a resposta renderizar linhas e contagens atuais; não fazer refetch de shell/áreas alheias.
- [x] Animar submit, retorno de sucesso, cópia, erro, troca de conteúdo e atualização da tabela, com movimento reduzido respeitado.
- [x] Remover URL hardcoded e `Math.random`; fazer busca estática final por `demoInvites`, fixtures e domínios fictícios nesta feature.

### Tarefa 5: Resgate no Painel e confirmação factual

**Arquivos:**

- Criar `app/painel/convite/page.tsx` e `app/painel/convite/loading.tsx`.
- Criar `features/panel/invites/model.ts`, `features/panel/invites/server/redemption.ts`, `features/panel/invites/actions.ts` e `features/panel/invites/components/invite-redemption-page.tsx`.
- Modificar `proxy.ts` somente se a revisão provar que o matcher/superfície atual não reconhece `/painel/convite` em Preview ou `painel.localhost`.

**Interfaces que entrega:** preview genérico do convite, criação de conta no território `panel` ou uso automático da sessão existente, aceite explícito com nome do restaurante e resultado factual.

- [x] Ler `token` da URL no servidor, calcular digest e consultar preview; não passar hash para o browser, não carregar terceiros e definir política `no-referrer` na tela.
- [x] Após preview, remover `token` da barra sem perder o token em memória necessário ao aceite; nunca persistir em `localStorage`, cookie duradouro, log ou analytics.
- [x] Apresentar nome/e-mail/senha somente para criação de conta; quando já houver sessão, aproveitá-la automaticamente sem oferecer alternância para login. Usar exclusivamente `createSupabaseServerClient("panel")` e respeitar o cookie isolado e os limites embutidos do Supabase Auth.
- [x] Para convite restrito, validar e-mail normalizado antes de signup quando possível e revalidar contra `auth.users` dentro do aceite; divergência bloqueia sem consumir. A RPC, não o estado do browser, é a autoridade.
- [x] Exigir nome do restaurante e aceite explícito; conferir nome/slug após debounce e validar novamente na transação; chamar uma RPC que cria restaurant `draft`, membership inicial, consumo e auditoria atomicamente.
- [x] Definir resultado final apenas após commit: nome e estado reais do restaurante e confirmação de acesso criado; não afirmar que identidade/contato/cardápio estão prontos e não redirecionar para `/identidade`.
- [x] Tratar token ausente/inválido/expirado/revogado/resgatado com uma mensagem pública genérica; preview não consome, falha/rede não consome e repetição do aceite não duplica restaurante.
- [x] Aplicar Motion sequencial, estados loading/erro/sucesso e reduced motion sem sidebar.

#### Ajuste de escopo aprovado em 30/10/2026

- No link do convite, a interface deslogada oferece somente criação de conta; sessão Painel já autenticada é aproveitada automaticamente. Não criar uma tela de login nesta etapa.
- Adicionar ícones aos campos, revelar/ocultar senha com Motion, permitir alternar o aceite clicando em qualquer parte do card e animar os campos em sequência com movimento reduzido respeitado.
- Debounce de 550 ms no nome do restaurante. A Action valida token/nome e consulta uma RPC protegida; a resposta expõe apenas o slug calculado e estados separados de disponibilidade do nome e da slug.
- Compartilhar a função de normalização do slug entre prévia e aceite. A transação recusa nome/slug ocupado, não cria sufixo randômico e mantém o índice único como proteção para concorrência.
- Arquivos: `features/panel/invites/components/invite-redemption-page.tsx`, `features/panel/invites/actions.ts`, `features/panel/invites/model.ts`, `features/panel/invites/server/redemption.ts` e migrations `supabase/migrations/20261030010000_check_panel_invite_restaurant_name.sql` e `supabase/migrations/20261030020000_panel_invite_availability_detail.sql`.
- Verificação: revisão estática dos contratos/SQL e inspeção manual da tela e estados. Não executar testes, build, lint, typecheck nem `git`, conforme `AGENTS.md`.

### Tarefa 6: Revisão estática final

**Arquivos:** migration, `.env.example`, rotas/Admin, DAL/Actions, componentes Admin e fluxo `/painel/convite` tocados nas tarefas anteriores.

- [x] Revisar estáticamente SQL e TypeScript: autorização em cada RPC/Action, `search_path` vazio nas funções definer, grants, FKs, locks, idempotência e resultado serializado.
- [x] Usar apenas busca/leitura estática permitida para confirmar que fixtures, links de exemplo e `Math.random` saíram do fluxo.
- [x] Inspecionar que o link usa a origem configurada do Painel e que o token não aparece nos DTOs, detalhes, logs, analytics ou persistência do browser.
- [x] Inspecionar que mutations atualizam apenas os recursos de convites e que nenhum estado real usa fixture como fallback.
- [x] Não executar testes, build, lint, typecheck nem comandos `git`, conforme instrução do repositório.

