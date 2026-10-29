# Admin inicial — Implementation Plan

> Plano para execução posterior à revisão da spec. Esta etapa cria apenas a migration de banco; não implementa páginas.

**Goal:** Criar a fundação de perfil e uma vaga atômica de Admin da plataforma por projeto Supabase.

**Architecture:** Supabase Auth mantém email e senha. Uma tabela de associação no Postgres atribui o papel Admin e impõe a unicidade. Funções RPC restritas permitem consultar se o cadastro está aberto e reivindicar a vaga sem expor gravação direta da tabela.

**Tech Stack:** Supabase Auth, PostgreSQL 17, Supabase CLI e SQL migrations.

**Spec:** docs/superpowers/specs/2026-10-29-platform-admin-identity-design.md

## Global Constraints

- Criar schema exclusivamente em supabase/migrations; não criar schema.sql ou migration do legado.
- No máximo um platform admin por projeto Supabase.
- O cadastro reabre quando o usuário Auth associado é removido, via ON DELETE CASCADE.
- Confirmação de e-mail permanece desligada.
- Não adicionar service_role, APP_SERVER_KEY, Express ou VAPID.
- Não criar usuário nem vínculo de Admin em migration ou seed.
- Não criar páginas, Server Actions ou componentes nesta etapa.
- Não adicionar nem executar testes automatizados, build, lint ou typecheck.
- Não aplicar migration em Produção.

## Review Focus

- Dois usuários reivindicam a vaga ao mesmo tempo: a restrição singleton deixa exatamente um Admin e o outro claim retorna false.
- Repetir claim pelo usuário que já ocupa a vaga: o resultado é idempotente e não altera a associação.
- Usuário anônimo consulta o estado: recebe somente um booleano e nenhum dado de identidade.
- Usuário autenticado tenta INSERT/UPDATE/DELETE direto em platform_admins: grants/RLS negam a operação.
- Usuário Admin é excluído de auth.users: a associação é removida e admin_registration_open() volta a retornar true.

As verificações acima são revisão estrutural dos objetos e permissões e aplicação da migration em Supabase local; não são uma solicitação para adicionar uma suíte de testes.

---

### Task 1: Alinhar a documentação canônica com a decisão aprovada

**Files:**
- Modify: __BASE.MD
- Modify: docs/superpowers/specs/2026-10-28-tavvi-app-infrastructure-design.md, somente a referência a bootstrap Admin manual, se mantida como documento vigente.

- [x] Substituir a premissa de que o Admin inicial é habilitado manualmente pela regra desta spec.
- [x] Preservar a seção que descreve como o Tavvi legado funciona como observação do legado.
- [x] Conferir que nenhuma decisão vigente continua afirmando que não haverá cadastro inicial pela aplicação.

### Task 2: Criar o arquivo de migration e o perfil Auth

**Files:**
- Create: supabase/migrations/20261029000000_platform_admin_identity.sql

- [ ] Criar public.profiles com user_id, display_name, created_at e updated_at.
- [ ] Criar a função trigger SECURITY DEFINER para inserir o perfil em auth.users; qualificar objetos e fixar search_path vazio.
- [ ] Associar o trigger a auth.users AFTER INSERT; usar ON CONFLICT DO NOTHING para tornar a operação idempotente.
- [ ] Criar função trigger BEFORE UPDATE que define updated_at com o relógio do banco e associá-la a profiles.
- [ ] Habilitar RLS em public.profiles.
- [ ] Criar SELECT policy para user_id = auth.uid().
- [ ] Criar UPDATE policy com USING e WITH CHECK vinculando user_id a auth.uid().
- [ ] Revogar todos os grants da role PUBLIC, anon e authenticated em public.profiles.
- [ ] Conceder SELECT e UPDATE(display_name) somente a authenticated, sujeitos às políticas.


### Task 3: Impor a vaga única de Admin

**Files:**
- Modify: supabase/migrations/20261029000000_platform_admin_identity.sql

- [ ] Criar public.platform_admins com singleton boolean como chave primária, DEFAULT true e CHECK singleton IS TRUE.
- [ ] Criar user_id como UNIQUE NOT NULL com referência a auth.users(id) ON DELETE CASCADE.
- [ ] Criar created_at e habilitar RLS.
- [ ] Criar SELECT policy para user_id = auth.uid().
- [ ] Revogar todos os grants da role PUBLIC, anon e authenticated; conceder SELECT somente a authenticated.


### Task 4: Criar as funções RPC de consulta e claim

**Files:**
- Modify: supabase/migrations/20261029000000_platform_admin_identity.sql

- [ ] Implementar public.is_platform_admin() RETURNS boolean usando auth.uid() e a associação atual.
- [ ] Implementar public.admin_registration_open() RETURNS boolean com resultado baseado apenas em EXISTS/NOT EXISTS.
- [ ] Implementar public.claim_platform_admin() RETURNS boolean, sem parâmetros; validar auth.uid(), inserir a vaga única atomicamente e retornar true para o próprio Admin ou false se a vaga pertencer a outro usuário.
- [ ] Definir SECURITY DEFINER e search_path vazio nas funções que precisam atravessar RLS; schema-qualify auth.uid() e objetos public.
- [ ] Revogar EXECUTE de PUBLIC e conceder EXECUTE de admin_registration_open() a anon/authenticated, is_platform_admin() a authenticated e claim_platform_admin() somente a authenticated.
- [ ] Não aceitar user_id, role ou metadata de privilégios enviados pelo cliente.

### Task 5: Revisar e aplicar a migration em Supabase local

**Files:**
- Review: supabase/migrations/20261029000000_platform_admin_identity.sql

- [ ] Fazer revisão estática da migration: ordem de criação, referências de schema, RLS, grants, search_path e comportamento ON DELETE CASCADE.
- [ ] Aplicar a migration pendente ao Supabase local, sem reset destrutivo de dados: pnpm exec supabase migration up --local.
- [ ] Inspecionar no banco local as tabelas, triggers, funções, restrições, RLS e grants resultantes.
- [ ] Confirmar que migration criou zero usuários Auth e zero associações platform_admins.
- [ ] Não executar teste automatizado nem comandos de build, lint ou typecheck.

### Task 6: Promover a mesma migration para Preview/Staging após revisão

**Files:**
- Use: supabase/migrations/20261029000000_platform_admin_identity.sql

- [ ] Conferir o project ref vinculado e validar que corresponde ao projeto vazio de Preview/Staging em São Paulo.
- [ ] Conferir o estado remoto de migrations antes de enviar schema.
- [ ] Aplicar a migration versionada ao projeto de Preview/Staging; não editar schema manualmente no Studio.
- [ ] Não configurar nem modificar Produção nesta etapa.
- [ ] Registrar o resultado da aplicação e manter o banco local e o remoto na mesma versão.

---

## Handoff

A execução é um único arquivo SQL com funções, grants e políticas fortemente acoplados; recomenda-se implementar nativamente em uma sessão para manter a migration coesa. A aplicação remota em Preview/Staging ocorre somente depois da revisão local e da confirmação do project ref.







