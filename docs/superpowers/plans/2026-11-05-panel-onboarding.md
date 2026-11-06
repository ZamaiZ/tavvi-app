# Painel e ativação do restaurante — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a conta criada ao aceitar um convite pelo login do painel e por um wizard de dois passos com autosave, ativando o restaurante e abrindo um template privado de Cardápio vazio.

**Architecture:** Manter autenticação de painel separada da de Admin e selecionar o restaurante ativo em cookie HttpOnly validado pelo servidor, conforme `__BASE.MD`. Criar persistência aditiva para identidade, contato e mídia, com RPCs protegidas que salvam somente rascunhos e ativam apenas após validação. O fluxo usa rotas curtas de Painel; a página pública `/{slug}` continua fora do escopo.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase SSR/Auth/Postgres/Storage, Zod, Motion, React Icons e componentes existentes.

**Spec:** [2026-11-05-panel-onboarding-design.md](../specs/2026-11-05-panel-onboarding-design.md)

## Global Constraints

- Não executar Git, `typecheck`, `build`, `lint` ou `test`; não adicionar testes.
- Não construir a página pública de cardápio `/{slug}` nem o catálogo.
- Preservar sessões e autorização separadas entre `admin` e `panel`.
- Seguir `__BASE.MD`: usar cookie HttpOnly `active_restaurant_id` como contexto selecionado; não colocar `restaurant_id` em caminhos de rota do Painel.
- Usar migrations aditivas; não importar nem aplicar a baseline legada de `tavvi`.
- Compor a UI com shadcn e utilitários Tailwind existentes; não adicionar CSS próprio por página/componente.
- Autosave após 2.500 ms sem alterações; autosave nunca muda status.
- Só a conclusão autenticada, validada e atômica pode trocar `draft` por `active`.
- Reutilizar componentes, tokens, presets e estilo de autenticação existentes; evitar dependências novas.
- Antes de alterar código Next.js, consultar a documentação local Next 16 sobre App Router, Proxy, Server Actions, redirects e rotas dinâmicas.
- Fazer revisão estática dos arquivos alterados; declarar no resumo que comandos de verificação proibidos não foram executados.

## Review Focus

- Uma sessão criada no aceite de convite deve pertencer ao cookie `panel`; confirmar que o sucesso abre o wizard e uma confirmação de email pendente não consome o convite.
- Autosave atrasado, requisições em andamento e navegação entre steps não podem perder a última edição nem ativar o restaurante.
- Um membro não pode salvar/ativar restaurante de outra conta ou mudar estado por payload; `suspended` não deve abrir painel funcional.
- Login com várias memberships deve exigir escolha explícita; o aceite recém-concluído deve abrir o restaurante retornado pelo RPC.
- Dados opcionais e mídia devem continuar válidos no rascunho; somente o conjunto final, validado no servidor, pode ativar e ficar pronto para futura leitura pública.

---

### Task 1: Modelo de dados e operações transacionais de onboarding

**Files:**
- Create: `supabase/migrations/20261105020000_panel_restaurant_onboarding.sql`
- Create: `features/panel/onboarding/schema.ts`
- Create: `features/panel/onboarding/model.ts`

**Interfaces:**
- Produces: `PanelRestaurantDraftInput`, `PanelRestaurantDTO`, validação de estado parcial para autosave e validação final para ativação.
- Produces RPCs `save_panel_restaurant_draft(p_restaurant_id uuid, p_step text, p_profile jsonb)` e `complete_panel_restaurant_onboarding(p_restaurant_id uuid, p_profile jsonb)`, ambas retornando JSON limitado `{ ok, code, restaurantId, status }`.

- [x] **Step 1: Consultar guias locais Next 16 usados pelo plano** — confirmar convenções para layouts/pages, Proxy, Server Actions e redirects nos respectivos guias em `node_modules/next/dist/docs/01-app/`.
- [x] **Step 2: Estender o schema aditivamente** — adicionar `description`, `segment`, `theme`, `menu_presentation`, `logo_path`, `cover_path`, `contact` e `onboarding_step` (somente `identity` ou `contact`) com defaults seguros que não alterem restaurantes existentes.
- [x] **Step 3: Criar schemas e DTOs de painel** — tipar os oito presets, cores hex, densidade, três apresentações, contato e endereço segundo os valores de Tavvi; manter nome/slug do convite como fonte de verdade.
- [x] **Step 4: Implementar RPC de autosave** — exigir `auth.uid()` e membership ativa, bloquear status diferente de `draft`, validar payload parcial e passo, comparar restaurante esperado com contexto selecionado quando aplicável e atualizar somente colunas de onboarding; nunca aceitar status do cliente.
- [x] **Step 5: Implementar RPC de conclusão** — dentro de uma transação, revalidar membership, estado e payload final, salvar todos os valores e atualizar status para `active`; retornar erro sem alterar estado se qualquer validação falhar.
- [x] **Step 6: Restringir execução e inspecionar SQL** — revogar execução pública, conceder apenas a `authenticated`, revisar `search_path`, checagens de identidade e associação, e confirmar que não há caminho de cliente que altera status arbitrariamente.

### Task 2: Login e acesso do painel

**Files:**
- Create: `features/panel/auth/schema.ts`
- Create: `features/panel/auth/state.ts`
- Create: `features/panel/auth/server.ts`
- Create: `features/panel/workspace/server/active-restaurant-cookie.ts`
- Create: `app/painel/(auth)/actions.ts`
- Create: `app/painel/(auth)/entrar/page.tsx`
- Create: `app/painel/(auth)/criar-conta/page.tsx`
- Create or modify: `features/admin/auth/components/admin-auth-shell.tsx` (extrair apenas o que for necessário para compartilhar a casca visual)
- Create: `features/panel/auth/components/panel-login-form.tsx`
- Create: `features/panel/auth/components/panel-contact-commercial.tsx`

**Interfaces:**
- Consumes: `PanelRestaurantDTO` e RPCs da Task 1.
- Produces: `signInPanel`, `getPanelLoginDestination`, `PanelAuthFormState` e `getPanelEntryDestination`.
- Destinos válidos no host Painel: `/identidade`, `/cardapio`, ou `/restaurantes` quando a conta possui várias memberships; em desenvolvimento local, o Proxy encaminha esses caminhos ao prefixo `/painel`.

- [x] **Step 1: Criar schema e estado de login** — aceitar email e senha, normalizar email e expor erros sem dados internos do Supabase.
- [x] **Step 2: Implementar autenticação Panel** — usar `createSupabaseServerClient("panel")`, conferir claims e memberships ativas; sessão sem membership válida deve ser localmente encerrada.
- [x] **Step 3: Resolver destino por membership** — uma membership segue pelo status; mais de uma vai para seleção explícita; restaurante `suspended` mostra estado indisponível.
- [x] **Step 4: Compartilhar o shell visual do Admin** — manter marca, painel ilustrado, hierarquia, motion e comportamento responsivo iguais; não reutilizar `signInPlatformAdmin` nem checagem `is_platform_admin`.
- [x] **Step 5: Construir login e ação de acesso** — criar `/painel/entrar` com campos de ícones, loading, validação, feedback e redirecionamento seguro para o destino resolvido.
- [x] **Step 6: Construir tela informativa de convite** — `/painel/criar-conta` exibe mensagem curta animada com ícone dizendo que o acesso exige convite e orienta a contatar o comercial; sem formulário, telefone ou endereço inventado.
- [x] **Step 7: Inspecionar isolamento de auth** — revisar imports, cookie names, actions e rotas para confirmar que login do painel não concede Admin e que login Admin não concede membership de restaurante.

### Task 3: Carregamento do restaurante, proteção de rotas e seleção

**Files:**
- Create: `features/panel/workspace/server/restaurants.ts`
- Create: `features/panel/workspace/actions.ts`
- Create: `app/painel/page.tsx`
- Create: `app/painel/restaurantes/page.tsx`
- Create: `features/panel/workspace/components/panel-restaurant-picker.tsx`
- Modify: `proxy.ts` e `lib/routing/host.ts` para host/root rewrite e refresh da sessão `panel`; autorização completa fica nos Server Components/actions.

**Interfaces:**
- Consumes: `getPanelLoginDestination` e `PanelRestaurantDTO` da Task 2.
- Produces: `getActivePanelRestaurant(expectedRestaurantId?)` e `getPanelRestaurantsForCurrentUser()`.

- [x] **Step 1: Implementar cookie de restaurante ativo** — criar utilitário server-only para ler/escrever `active_restaurant_id` HttpOnly, Secure em produção, SameSite=Lax, Path=/; validar membership a cada leitura e mutação.
- [x] **Step 2: Implementar leitura do restaurante ativo** — usar o ID do cookie, validar DTO em Zod e comparar `expectedRestaurantId` enviado pela tela para detectar troca de restaurante em outra aba.
- [x] **Step 3: Proteger páginas e ações no servidor** — tratar Proxy apenas como refresh otimista da sessão; validar identidade, associação, contexto e status em cada Server Component e Server Action.
- [x] **Step 4: Implementar destinos de `/painel`** — atualizar `proxy.ts` para refresh/rewrite da raiz `painel.localhost`; sessão ausente segue ao login; restaurante selecionado direciona por status; múltiplos acessíveis abrem a lista de seleção.
- [x] **Step 5: Criar seleção simples de restaurantes** — listar nome/status das memberships ativas, permitir trocar contexto por Server Action validada e fazer cada escolha abrir `/identidade` ou `/cardapio` por status.
- [x] **Step 6: Fazer revisão estática de acesso cruzado** — inspecionar cada página/action, adulteração de cookie e concorrência entre abas; confirmar que o ID de contexto nunca substitui validação de membership.

### Task 4: Wizard de identidade/contato com autosave e mídia

**Files:**
- Create: `features/panel/onboarding/actions.ts`
- Create: `features/panel/onboarding/components/onboarding-wizard.tsx`
- Create: `features/panel/onboarding/components/identity-step.tsx`
- Create: `features/panel/onboarding/components/contact-step.tsx`
- Create: `features/panel/onboarding/components/icon-input.tsx`
- Create: `app/painel/identidade/page.tsx`
- Create: `app/painel/contato/page.tsx`
- Create: `supabase/migrations/20261105030000_panel_restaurant_brand_storage.sql`

**Interfaces:**
- Consumes: schemas/model e RPCs da Task 1; acesso/guards da Task 3.
- Produces: `savePanelRestaurantDraftAction(input)` e `completePanelRestaurantOnboardingAction(input)`; ambas conferem `expectedRestaurantId` contra o cookie de restaurante ativo.
- Autosave envia snapshot atual de dados editáveis após 2.500 ms sem mudanças; ação final também envia snapshot integral mais recente.

- [x] **Step 1: Implementar leitura inicial do wizard** — `/identidade` e `/contato` carregam draft pelo cookie de restaurante ativo, enviam apenas dados do restaurante autorizado e retomam `onboarding_step`; status diferente de `draft` redireciona por status.
- [x] **Step 2: Criar infraestrutura visual do wizard** — card/container responsivo, stepper Identidade/Contato, animações de entrada/saída e movimento reduzido.
- [x] **Step 3: Criar inputs com ícones** — usar `Field`, `InputGroup`, `Combobox`, `Button` e ícones existentes, com labels acessíveis, erros por campo e estado desabilitado.
- [x] **Step 4: Criar step Identidade** — resumo do nome e slug somente leitura, segmento, apresentação, presets, cores, densidade e seleção opcional de logo/capa; opções derivam dos oito temas e segmentos existentes em `tavvi`.
- [x] **Step 5: Criar step Contato** — nome/descrição, telefone, WhatsApp, Instagram, endereço estruturado, link do Maps e link direto de avaliação Google separado, com UF em combobox; contato pode ficar vazio. Avançar entre `/identidade` e `/contato` mantendo o stepper e o autosave.
- [x] **Step 6: Adicionar bucket e políticas de mídia** — guardar logo/capa em bucket privado sob prefixo do restaurante, validar MIME e tamanho, permitir escrita apenas para membership ativa em `draft`, e gerar URLs temporárias para prévia do wizard.
- [x] **Step 7: Implementar autosave de 2.500 ms** — consolidar mudanças dos dois steps, cancelar timer substituído, indicar salvando/salvo/erro e tratar falha sem perder valores locais; impedir respostas antigas de marcar snapshot novo como salvo.
- [x] **Step 8: Finalizar sem corrida de gravação** — botão final valida cliente, envia snapshot integral à RPC atômica, aguarda upload pendente e só então navega a `/cardapio` após sucesso.
- [x] **Step 9: Fazer revisão estática dos casos de rascunho** — conferir saída do timer, navegação entre steps, edição durante requisição, upload falho, rede indisponível, estado suspenso e respeito a movimento reduzido; confirmar que autosave nunca envia status.

### Task 5: Entrada pelo convite e destinos pós-aceite

**Files:**
- Modify: `features/panel/invites/components/invite-redemption-page.tsx`
- Modify: `features/panel/invites/actions.ts`
- Modify: `features/panel/invites/model.ts` se necessário para incluir destino confiável baseado no resultado do servidor.
- Modify: `features/panel/invites/server/redemption.ts` apenas se o retorno do RPC precisar ser complementado por leitura autenticada.

**Interfaces:**
- Consumes: destino de onboarding/cardápio da Task 3 e wizard da Task 4.
- Produces: aceite bem-sucedido define o restaurante recém-retornado como ativo no cookie e navega a `/identidade` se `draft`, ou `/cardapio` se `active`.

- [x] **Step 1: Ajustar sucesso do aceite** — substituir a tela de sucesso terminal por navegação à área do restaurante retornada pelo RPC; o servidor atualiza `active_restaurant_id` no mesmo fluxo autenticado.
- [x] **Step 2: Preservar a sessão criada pelo cadastro** — não chamar login novamente; usar cookie `panel` já estabelecido no `signUp`; convite com confirmação de email pendente mantém o comportamento de retomada sem consumir o convite.
- [x] **Step 3: Validar aceite por usuário já autenticado** — abrir o wizard do restaurante recém-criado, mesmo se a conta possuir outras memberships.
- [x] **Step 4: Fazer revisão estática do retorno** — confirmar que ID/status vêm do retorno validado do servidor, não de campos controlados pelo cliente, e que erros existentes do aceite continuam apresentados.

### Task 6: Template interno vazio de Cardápio e redirecionamentos por estado

**Files:**
- Create: `app/painel/cardapio/page.tsx`
- Create: `features/panel/workspace/components/panel-menu-template.tsx`
- Create: `features/panel/workspace/components/panel-suspended-state.tsx`

**Interfaces:**
- Consumes: guards de membership/status da Task 3 e dados do restaurante.
- Produces: destino interno vazio para usuários `active`; nenhuma rota pública de menu.

- [x] **Step 1: Criar a página Cardápio vazia** — template responsivo dentro do padrão Tavvi, título/identidade do restaurante e espaço claramente reservado para continuação futura, sem editor nem catálogo.
- [x] **Step 2: Aplicar guardas de status** — `active` vê template; `draft` volta a `/identidade` ou `/contato` conforme o step persistido; `suspended` vê mensagem sem dados operacionais.
- [x] **Step 3: Inspecionar rotas públicas e privadas** — confirmar que nenhuma rota `/{slug}` foi adicionada ou alterada e que IDs de outro restaurante não revelam nome, slug ou perfil.

### Task 7: Revisão final estática da entrega

**Files:**
- Revisar os arquivos criados e modificados nas Tasks 1–6.

- [x] **Step 1: Revisar o percurso completo por inspeção** — convite com conta nova, sessão existente, login posterior, uma ou várias memberships, edição/autosave, reload, finalização, Cardápio vazio e status suspenso.
- [x] **Step 2: Conferir dados futuros de `/{slug}`** — nome/slug, descrição, segmento, mídia, tema, apresentação, densidade, contato e endereço/Maps persistem; nenhum produto/categoria é requisito de ativação.
- [x] **Step 3: Conferir as restrições de execução** — sem comando Git, teste, lint, build ou typecheck; nenhuma dependência adicionada sem necessidade.
