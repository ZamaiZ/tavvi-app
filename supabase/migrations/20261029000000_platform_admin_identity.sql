-- ============================================================================
-- Tavvi: identidade de usuários e vaga única de administrador da plataforma.
--
-- Esta migration pertence ao tavvi-app e parte de um projeto Supabase novo.
-- Ela não importa o schema do Tavvi legado, não cria usuários em auth.users
-- e não atribui automaticamente a vaga de Admin.
--
-- O email/senha e as sessões continuam sob responsabilidade do Supabase Auth.
-- Esta migration cria apenas o perfil de exibição e a associação de autorização.
--
-- A vaga é única por projeto Supabase: Local, Preview/Staging e Produção têm
-- bancos Auth separados e cada um terá sua própria primeira conta Admin.
--
-- A confirmação de email é configuração do Supabase Auth, não SQL de schema.
-- Ela permanece desligada conforme a configuração já decidida para o produto.
--
-- IMPORTANTE: aplicar este arquivo pela Supabase CLI para registrar a versão
-- em supabase_migrations.schema_migrations. Executar o conteúdo diretamente no
-- SQL Editor do Studio altera o banco, mas não registra a migration no histórico.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Perfil público mínimo para dados de apresentação do usuário.
--
-- auth.users continua sendo a fonte de verdade para email, senha e identidade.
-- user_id é simultaneamente PK e FK: cada Auth user pode ter no máximo um
-- perfil, e a exclusão do Auth user remove seu perfil automaticamente.
--
-- display_name é opcional na tabela porque outros fluxos Auth podem ainda não
-- ter concluído o perfil. O formulário futuro de criação do Admin exigirá um
-- nome; este valor nunca será usado para conceder privilégios.
-- ----------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_display_name_length_check
    check (
      display_name is null
      or pg_catalog.char_length(pg_catalog.btrim(display_name)) between 1 and 120
    )
);

comment on table public.profiles is
  'Dados de apresentação vinculados a um usuário do Supabase Auth; não contém credenciais nem papéis.';
comment on column public.profiles.user_id is
  'Identificador do usuário Auth; a exclusão de auth.users remove esta linha por cascata.';
comment on column public.profiles.display_name is
  'Nome de apresentação. Metadata Auth pode preencher o valor, mas não concede autorização.';
comment on column public.profiles.created_at is
  'Instante em que o perfil foi criado pelo banco.';
comment on column public.profiles.updated_at is
  'Instante da última atualização do perfil, definido por trigger do banco.';


-- ----------------------------------------------------------------------------
-- Atualiza updated_at em toda alteração do perfil.
--
-- SECURITY INVOKER é o comportamento padrão, declarado aqui explicitamente.
-- O search_path vazio evita resolução de nomes por schemas controlados pelo
-- chamador. pg_catalog.now() é qualificado para não depender do search_path.
-- ----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$function$;

comment on function public.set_updated_at() is
  'Trigger helper: define updated_at pelo relógio do banco antes de atualizar uma linha.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- Cria um perfil quando o Supabase Auth cria uma identidade.
--
-- A função roda com privilégios do proprietário da função para poder escrever
-- no perfil durante o trigger Auth. search_path fica vazio e toda referência a
-- objetos é qualificada. Só lê raw_user_meta_data.display_name para exibição.
--
-- ON CONFLICT DO NOTHING torna a criação segura caso o perfil já exista; não
-- sobrescreve um nome que o usuário já tenha alterado.
-- ----------------------------------------------------------------------------
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

comment on function public.handle_new_auth_user() is
  'Trigger Auth: cria o perfil do usuário sem atribuir papel ou privilégio.';

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user();


-- ----------------------------------------------------------------------------
-- Vaga única para Admin da plataforma.
--
-- singleton só pode ser TRUE e é a PK. Portanto, a tabela aceita zero ou uma
-- linha, nunca duas, inclusive se duas transações tentarem reivindicar a vaga
-- ao mesmo tempo. user_id também é UNIQUE para não permitir repetir a mesma
-- identidade em outras linhas caso o modelo seja alterado no futuro.
--
-- ON DELETE CASCADE implementa a decisão de reabrir o cadastro: remover o
-- usuário Admin do Supabase Auth remove esta associação, deixando a tabela vazia.
-- ----------------------------------------------------------------------------
create table public.platform_admins (
  singleton boolean primary key not null default true,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  constraint platform_admins_singleton_must_be_true_check
    check (singleton is true)
);

comment on table public.platform_admins is
  'Associação da única conta Admin da plataforma neste projeto Supabase.';
comment on column public.platform_admins.singleton is
  'Chave fixa TRUE cuja PK garante no máximo uma associação de Admin.';
comment on column public.platform_admins.user_id is
  'Usuário Auth autorizado como Admin; remover esse Auth user reabre a vaga por cascata.';
comment on column public.platform_admins.created_at is
  'Instante em que a identidade reivindicou a vaga de Admin.';

-- RLS impede que a Data API trate esta tabela como uma tabela pública comum.
-- A política abaixo só permite ao usuário consultar a própria associação.
-- A aplicação não recebe políticas nem grants para gravar diretamente.
alter table public.platform_admins enable row level security;

create policy platform_admins_select_own
on public.platform_admins
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Removemos privilégios herdados/defaults, incluindo o papel PostgreSQL PUBLIC.
-- Em seguida, permitimos apenas a leitura autenticada, sempre filtrada por RLS.
revoke all on table public.platform_admins from PUBLIC, anon, authenticated;
grant select on table public.platform_admins to authenticated;


-- ----------------------------------------------------------------------------
-- RLS e permissões para perfis.
--
-- SELECT e UPDATE são concedidos apenas a authenticated e ainda passam pelas
-- políticas por linha. O cliente só pode ler seu perfil e alterar display_name.
-- Não há INSERT: o trigger Auth cria a linha. Não há grants de DELETE.
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.profiles from PUBLIC, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;


-- ----------------------------------------------------------------------------
-- Função de autorização para políticas e operações futuras.
--
-- SECURITY DEFINER permite consultar a associação mesmo com RLS ativo, sem
-- expor a tabela inteira ao chamador. A função não aceita user_id como entrada:
-- sempre verifica auth.uid() da sessão corrente. Somente authenticated pode executar a função.
-- ----------------------------------------------------------------------------
create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.user_id = (select auth.uid())
  );
$function$;

comment on function public.is_platform_admin() is
  'Retorna se a identidade Auth da sessão atual possui o papel Admin da plataforma.';


-- ----------------------------------------------------------------------------
-- Estado público mínimo necessário para a tela de criação.
--
-- Retorna somente TRUE quando a vaga está livre; caso contrário, FALSE.
-- Não revela email, ID ou qualquer dado da conta Admin. A RPC precisa ser
-- acessível a anon para que /admin possa exibir a mensagem sem sessão.
--
-- Isso controla somente a associação ao papel Admin. Não desabilita signup
-- global do Supabase Auth, que será usado futuramente por convites do Painel.
-- ----------------------------------------------------------------------------
create function public.admin_registration_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select not exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.singleton is true
  );
$function$;

comment on function public.admin_registration_open() is
  'Retorna somente se a vaga única de Admin está livre, sem identificar a conta atual.';


-- ----------------------------------------------------------------------------
-- Claim atômico da vaga pelo usuário autenticado.
--
-- A função ignora qualquer user_id fornecido pelo cliente porque não recebe
-- argumentos e usa exclusivamente auth.uid(). INSERT ... ON CONFLICT no slot
-- singleton decide a concorrência dentro do Postgres: somente uma transação
-- pode inserir TRUE. Depois, EXISTS diferencia o próprio usuário (TRUE,
-- inclusive em retry) de outro usuário que ganhou a vaga (FALSE).
--
-- Uma sessão sem UID é recusada. SECURITY DEFINER permite a gravação protegida
-- mesmo sem grant/policy de INSERT na tabela. search_path vazio e nomes
-- qualificados reduzem risco de resolução maliciosa de objetos.
--
-- Como email confirmation está desligado e não há segredo de bootstrap, esta
-- função não prova quem é o responsável: ele deve reivindicar primeiro a vaga
-- em cada ambiente antes de divulgar o endereço. Após claim, usuários Auth
-- posteriores não podem obter o papel; a página futura mostra cadastro fechado.
-- ----------------------------------------------------------------------------
create function public.claim_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'A sessão autenticada é necessária para reivindicar o Admin.';
  end if;

  insert into public.platform_admins (singleton, user_id)
  values (true, current_user_id)
  on conflict (singleton) do nothing;

  return exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.singleton is true
      and platform_admin.user_id = current_user_id
  );
end;
$function$;

comment on function public.claim_platform_admin() is
  'Reivindica atomicamente a vaga única para auth.uid(); não aceita identidade informada pelo cliente.';


-- ----------------------------------------------------------------------------
-- EXECUTE é concedido explicitamente porque funções PostgreSQL costumam ser
-- executáveis por PUBLIC por padrão.
--
-- is_platform_admin() e claim_platform_admin() exigem sessão autenticada.
-- admin_registration_open() é a única função desta migration exposta a anon,
-- pois a tela precisa saber se deve exibir o formulário ou a mensagem de
-- cadastro encerrado. Nenhuma destas permissões concede gravação direta nas
-- tabelas.
-- ----------------------------------------------------------------------------
revoke all on function public.set_updated_at() from PUBLIC, anon, authenticated;
revoke all on function public.handle_new_auth_user() from PUBLIC, anon, authenticated;
revoke all on function public.is_platform_admin() from PUBLIC, anon, authenticated;
revoke all on function public.admin_registration_open() from PUBLIC, anon, authenticated;
revoke all on function public.claim_platform_admin() from PUBLIC, anon, authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_registration_open() to anon, authenticated;
grant execute on function public.claim_platform_admin() to authenticated;


-- ----------------------------------------------------------------------------
-- Fim da migration.
--
-- Nenhuma linha é inserida em platform_admins aqui. O primeiro Admin entra
-- depois, pelo fluxo Auth + claim_platform_admin() da aplicação. A aplicação
-- deve tratar FALSE como “a vaga já foi reivindicada por outra conta”.
-- ----------------------------------------------------------------------------

