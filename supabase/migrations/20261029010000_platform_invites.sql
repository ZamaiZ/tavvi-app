-- Convites de plataforma, registro mínimo de restaurantes e resgate atômico.
-- Este schema pertence ao tavvi-app; não importa dados nem a baseline legada.

create table public.restaurants (
  id uuid primary key not null default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'draft',
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint restaurants_name_length_check
    check (pg_catalog.char_length(pg_catalog.btrim(name)) between 2 and 120),
  constraint restaurants_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint restaurants_status_check
    check (status in ('draft', 'active', 'suspended')),
  constraint restaurants_slug_key unique (slug)
);

comment on table public.restaurants is
  'Registro mínimo de restaurantes criados por convites; a configuração completa pertence ao onboarding posterior.';
comment on column public.restaurants.status is
  'O restaurante começa em draft e só muda de estado por operações futuras autorizadas.';

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row
execute function public.set_updated_at();

create table public.memberships (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position text not null,
  status text not null default 'active',
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint memberships_position_length_check
    check (pg_catalog.char_length(pg_catalog.btrim(position)) between 1 and 80),
  constraint memberships_status_check
    check (status in ('active', 'removed')),
  constraint memberships_restaurant_user_key unique (restaurant_id, user_id)
);

comment on table public.memberships is
  'Associação de uma conta Auth a um restaurante; position é informativo e não concede permissões.';
comment on column public.memberships.position is
  'Cargo organizacional. Não é usado para autorização.';

create index memberships_user_status_idx
  on public.memberships (user_id, status, restaurant_id);

create table public.platform_invites (
  id uuid primary key not null default gen_random_uuid(),
  email text,
  token_hash bytea not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  revoked_at timestamptz,
  supersedes_invite_id uuid references public.platform_invites (id) on delete set null,
  idempotency_key uuid not null,
  constraint platform_invites_email_normalized_check
    check (
      email is null
      or (
        email = pg_catalog.lower(pg_catalog.btrim(email))
        and pg_catalog.char_length(email) between 3 and 254
        and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  constraint platform_invites_token_hash_length_check
    check (pg_catalog.octet_length(token_hash) = 32),
  constraint platform_invites_token_hash_key unique (token_hash),
  constraint platform_invites_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  constraint platform_invites_use_revoke_exclusive_check
    check (redeemed_at is null or revoked_at is null),
  constraint platform_invites_idempotency_key_key unique (idempotency_key)
);

comment on table public.platform_invites is
  'Convites de entrada para clientes iniciarem um restaurante; token claro nunca é persistido.';
comment on column public.platform_invites.token_hash is
  'SHA-256 de 32 bytes do token de uso único. Nunca retornar este campo por RPC.';
comment on column public.platform_invites.created_by is
  'Admin que emitiu o convite; nulável para preservar histórico após exclusão da conta Auth.';
comment on column public.platform_invites.supersedes_invite_id is
  'Convite anterior invalidado por rotação ou alteração de e-mail/validade.';

create index platform_invites_created_order_idx
  on public.platform_invites (created_at desc, id desc);
create index platform_invites_email_prefix_idx
  on public.platform_invites (pg_catalog.lower(email) text_pattern_ops)
  where email is not null;
create index platform_invites_expirable_idx
  on public.platform_invites (expires_at)
  where redeemed_at is null and revoked_at is null;
create unique index platform_invites_single_replacement_idx
  on public.platform_invites (supersedes_invite_id)
  where supersedes_invite_id is not null;

create table public.audit_log (
  id uuid primary key not null default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint audit_log_metadata_object_check
    check (pg_catalog.jsonb_typeof(metadata) = 'object')
);

comment on table public.audit_log is
  'Eventos transacionais de plataforma; ator anulável e metadata sem token nem credencial.';

create index audit_log_target_idx
  on public.audit_log (target_type, target_id, created_at desc);

create table public.platform_invite_rate_limits (
  scope text not null,
  invite_id uuid references public.platform_invites (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null,
  constraint platform_invite_rate_limits_scope_check
    check (scope in ('preview', 'accept', 'admin')),
  constraint platform_invite_rate_limits_subject_check
    check (
      (scope = 'preview' and invite_id is not null and user_id is null)
      or (scope in ('accept', 'admin') and invite_id is null and user_id is not null)
    ),
  constraint platform_invite_rate_limits_count_check
    check (request_count > 0)
);

create unique index platform_invite_rate_limits_invite_key
  on public.platform_invite_rate_limits (scope, invite_id)
  where invite_id is not null;
create unique index platform_invite_rate_limits_user_key
  on public.platform_invite_rate_limits (scope, user_id)
  where user_id is not null;

alter table public.restaurants enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_invites enable row level security;
alter table public.audit_log enable row level security;
alter table public.platform_invite_rate_limits enable row level security;

create policy restaurants_select_member_or_platform_admin
on public.restaurants
for select
to authenticated
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.memberships as membership
    where membership.restaurant_id = restaurants.id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

create policy memberships_select_own_or_platform_admin
on public.memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_platform_admin())
);

revoke all on table public.restaurants from PUBLIC, anon, authenticated;
revoke all on table public.memberships from PUBLIC, anon, authenticated;
revoke all on table public.platform_invites from PUBLIC, anon, authenticated;
revoke all on table public.audit_log from PUBLIC, anon, authenticated;
revoke all on table public.platform_invite_rate_limits from PUBLIC, anon, authenticated;
grant select on table public.restaurants to authenticated;
grant select on table public.memberships to authenticated;

create function public.consume_platform_invite_rate_limit(
  p_scope text,
  p_invite_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_time_value timestamptz := pg_catalog.clock_timestamp();
  current_window timestamptz;
  request_limit integer;
  current_count integer;
begin
  if p_scope = 'preview' and p_invite_id is not null and p_user_id is null then
    request_limit := 60;
  elsif p_scope = 'accept' and p_invite_id is null and p_user_id is not null then
    request_limit := 5;
  elsif p_scope = 'admin' and p_invite_id is null and p_user_id is not null then
    request_limit := 20;
  else
    return false;
  end if;

  current_window := pg_catalog.to_timestamp(
    pg_catalog.floor(pg_catalog.date_part('epoch', current_time_value) / 300) * 300
  );

  if p_scope = 'preview' then
    insert into public.platform_invite_rate_limits (
      scope, invite_id, user_id, window_started_at, request_count
    )
    values (p_scope, p_invite_id, null, current_window, 1)
    on conflict (scope, invite_id) where invite_id is not null
    do update set
      window_started_at = excluded.window_started_at,
      request_count = case
        when public.platform_invite_rate_limits.window_started_at = excluded.window_started_at
          then public.platform_invite_rate_limits.request_count + 1
        else 1
      end
    returning request_count into current_count;
  else
    insert into public.platform_invite_rate_limits (
      scope, invite_id, user_id, window_started_at, request_count
    )
    values (p_scope, null, p_user_id, current_window, 1)
    on conflict (scope, user_id) where user_id is not null
    do update set
      window_started_at = excluded.window_started_at,
      request_count = case
        when public.platform_invite_rate_limits.window_started_at = excluded.window_started_at
          then public.platform_invite_rate_limits.request_count + 1
        else 1
      end
    returning request_count into current_count;
  end if;

  return current_count <= request_limit;
end;
$function$;

create function public.list_platform_invites(
  p_search text default '',
  p_status text default 'all',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_search text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_search, '')));
  escaped_search text;
  normalized_status text := coalesce(p_status, 'all');
  requested_page integer := coalesce(p_page, 1);
  requested_page_size integer := coalesce(p_page_size, 25);
  result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;

  if pg_catalog.char_length(normalized_search) > 254
    or normalized_status not in ('all', 'pending', 'redeemed', 'expired', 'revoked')
    or requested_page < 1 or requested_page > 1000000
    or requested_page_size < 1 or requested_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid_invite_query';
  end if;

  escaped_search := pg_catalog.replace(
    pg_catalog.replace(
      pg_catalog.replace(normalized_search, E'\\', E'\\\\'),
      '%', E'\\%'
    ),
    '_', E'\\_'
  );

  with base as not materialized (
    select
      invite.id,
      invite.email,
      invite.created_at,
      invite.expires_at,
      invite.redeemed_at,
      invite.redeemed_by,
      invite.restaurant_id,
      invite.revoked_at,
      restaurant.name as restaurant_name,
      case
        when invite.revoked_at is not null then 'revoked'
        when invite.redeemed_at is not null then 'redeemed'
        when invite.expires_at <= pg_catalog.statement_timestamp() then 'expired'
        else 'pending'
      end as status
    from public.platform_invites as invite
    left join public.restaurants as restaurant on restaurant.id = invite.restaurant_id
  ), filtered as not materialized (
    select *
    from base
    where (normalized_status = 'all' or status = normalized_status)
      and (
        normalized_search = ''
        or (
          email is not null
          and pg_catalog.lower(email) like escaped_search || '%' escape E'\\'
        )
      )
  ), totals as (
    select
      pg_catalog.count(*)::integer as total_rows,
      pg_catalog.count(*) filter (where status = 'pending')::integer as pending_count,
      pg_catalog.count(*) filter (where status = 'redeemed')::integer as redeemed_count,
      pg_catalog.count(*) filter (where status = 'expired')::integer as expired_count,
      pg_catalog.count(*) filter (where status = 'revoked')::integer as revoked_count
    from base
  ), filtered_total as (
    select pg_catalog.count(*)::integer as total_rows from filtered
  ), pagination as (
    select
      case
        when filtered_total.total_rows = 0 then 1
        else least(
          requested_page,
          pg_catalog.ceil(filtered_total.total_rows::numeric / requested_page_size)::integer
        )
      end as effective_page,
      filtered_total.total_rows
    from filtered_total
  ), ranked as (
    select
      filtered.*,
      pg_catalog.row_number() over (
        order by filtered.created_at desc, filtered.id desc
      ) as pagination_row
    from filtered
  ), paged as (
    select ranked.*
    from ranked
    cross join pagination
    where ranked.pagination_row >
      (pagination.effective_page - 1) * requested_page_size
      and ranked.pagination_row <= pagination.effective_page * requested_page_size
  )
  select pg_catalog.jsonb_build_object(
    'rows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', id,
          'email', email,
          'status', status,
          'createdAt', created_at,
          'expiresAt', expires_at,
          'redeemedAt', redeemed_at,
          'redeemedBy', redeemed_by,
          'restaurantId', restaurant_id,
          'restaurantName', restaurant_name,
          'revokedAt', revoked_at
        ) order by created_at desc, id desc
      ) from paged
    ), '[]'::jsonb),
    'counts', pg_catalog.jsonb_build_object(
      'all', totals.total_rows,
      'pending', totals.pending_count,
      'redeemed', totals.redeemed_count,
      'expired', totals.expired_count,
      'revoked', totals.revoked_count
    ),
    'totalRows', pagination.total_rows,
    'page', pagination.effective_page,
    'pageSize', requested_page_size
  )
  into result
  from totals
  cross join pagination;

  return result;
end;
$function$;

create function public.create_platform_invite(
  p_email text,
  p_valid_days integer,
  p_token_hash_hex text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_email text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))), '');
  existing_id uuid;
  existing_actor uuid;
  invite_id uuid;
  invite_expiry timestamptz;
begin
  if actor_id is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;
  if p_valid_days is null or p_valid_days not between 1 and 30
    or p_idempotency_key is null
    or p_token_hash_hex is null
    or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or (normalized_email is not null and (
      pg_catalog.char_length(normalized_email) > 254
      or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )) then
    raise exception using errcode = '22023', message = 'invalid_invite_input';
  end if;

  select invite.id, invite.created_by
  into existing_id, existing_actor
  from public.platform_invites as invite
  where invite.idempotency_key = p_idempotency_key;
  if existing_id is not null then
    if existing_actor is distinct from actor_id then
      raise exception using errcode = '42501', message = 'platform_admin_required';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'created', false, 'linkAvailable', false, 'id', existing_id
    );
  end if;

  if not public.consume_platform_invite_rate_limit('admin', null, actor_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.platform_invites (
    email, token_hash, created_by, expires_at, idempotency_key
  ) values (
    normalized_email,
    pg_catalog.decode(p_token_hash_hex, 'hex'),
    actor_id,
    pg_catalog.statement_timestamp() + pg_catalog.make_interval(days => p_valid_days),
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id, expires_at into invite_id, invite_expiry;

  if invite_id is null then
    select invite.id, invite.created_by
    into existing_id, existing_actor
    from public.platform_invites as invite
    where invite.idempotency_key = p_idempotency_key;
    if existing_actor is distinct from actor_id then
      raise exception using errcode = '42501', message = 'platform_admin_required';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'created', false, 'linkAvailable', false, 'id', existing_id
    );
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'platform_invite.created',
    'platform_invite',
    invite_id,
    pg_catalog.jsonb_build_object('validDays', p_valid_days)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'created', true,
    'linkAvailable', true,
    'id', invite_id,
    'email', normalized_email,
    'createdAt', pg_catalog.statement_timestamp(),
    'expiresAt', invite_expiry
  );
end;
$function$;

create function public.replace_platform_invite(
  p_invite_id uuid,
  p_email text,
  p_valid_days integer,
  p_token_hash_hex text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_email text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))), '');
  previous_invite public.platform_invites%rowtype;
  replay_id uuid;
  replay_actor uuid;
  replacement_id uuid;
  replacement_expiry timestamptz;
  previous_status text;
begin
  if actor_id is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;
  if p_invite_id is null or p_valid_days is null or p_valid_days not between 1 and 30
    or p_idempotency_key is null
    or p_token_hash_hex is null
    or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or (normalized_email is not null and (
      pg_catalog.char_length(normalized_email) > 254
      or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )) then
    raise exception using errcode = '22023', message = 'invalid_invite_input';
  end if;

  select invite.* into previous_invite
  from public.platform_invites as invite
  where invite.id = p_invite_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_replaceable');
  end if;

  select invite.id, invite.created_by
  into replay_id, replay_actor
  from public.platform_invites as invite
  where invite.idempotency_key = p_idempotency_key;
  if replay_id is not null then
    if replay_actor is distinct from actor_id then
      raise exception using errcode = '42501', message = 'platform_admin_required';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'created', false, 'linkAvailable', false, 'id', replay_id
    );
  end if;

  previous_status := case
    when previous_invite.revoked_at is not null then 'revoked'
    when previous_invite.redeemed_at is not null then 'redeemed'
    when previous_invite.expires_at <= pg_catalog.statement_timestamp() then 'expired'
    else 'pending'
  end;
  if previous_status not in ('pending', 'expired') then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_replaceable');
  end if;
  if not public.consume_platform_invite_rate_limit('admin', null, actor_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.platform_invites (
    email, token_hash, created_by, expires_at, supersedes_invite_id, idempotency_key
  ) values (
    normalized_email,
    pg_catalog.decode(p_token_hash_hex, 'hex'),
    actor_id,
    pg_catalog.statement_timestamp() + pg_catalog.make_interval(days => p_valid_days),
    previous_invite.id,
    p_idempotency_key
  )
  returning id, expires_at into replacement_id, replacement_expiry;

  update public.platform_invites as invite
  set revoked_at = pg_catalog.statement_timestamp()
  where invite.id = previous_invite.id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'platform_invite.replaced',
    'platform_invite',
    replacement_id,
    pg_catalog.jsonb_build_object(
      'supersedesInviteId', previous_invite.id,
      'validDays', p_valid_days
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'created', true,
    'linkAvailable', true,
    'id', replacement_id,
    'email', normalized_email,
    'createdAt', pg_catalog.statement_timestamp(),
    'expiresAt', replacement_expiry
  );
end;
$function$;

create function public.revoke_platform_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  invite public.platform_invites%rowtype;
  current_status text;
begin
  if actor_id is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;
  if p_invite_id is null then
    raise exception using errcode = '22023', message = 'invalid_invite_id';
  end if;

  select stored_invite.* into invite
  from public.platform_invites as stored_invite
  where stored_invite.id = p_invite_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_revocable');
  end if;

  current_status := case
    when invite.revoked_at is not null then 'revoked'
    when invite.redeemed_at is not null then 'redeemed'
    when invite.expires_at <= pg_catalog.statement_timestamp() then 'expired'
    else 'pending'
  end;
  if current_status <> 'pending' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_revocable');
  end if;
  if not public.consume_platform_invite_rate_limit('admin', null, actor_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  update public.platform_invites as stored_invite
  set revoked_at = pg_catalog.statement_timestamp()
  where stored_invite.id = invite.id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'platform_invite.revoked',
    'platform_invite',
    invite.id,
    '{}'::jsonb
  );

  return pg_catalog.jsonb_build_object('ok', true, 'id', invite.id, 'status', 'revoked');
end;
$function$;

create function public.preview_platform_invite(p_token_hash_hex text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.platform_invites%rowtype;
  current_status text;
begin
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  select stored_invite.* into invite
  from public.platform_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex');
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  if not public.consume_platform_invite_rate_limit('preview', invite.id, null) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  current_status := case
    when invite.revoked_at is not null then 'revoked'
    when invite.redeemed_at is not null then 'redeemed'
    when invite.expires_at <= pg_catalog.statement_timestamp() then 'expired'
    else 'pending'
  end;
  if current_status <> 'pending' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'expiresAt', invite.expires_at,
    'emailRequired', invite.email is not null
  );
end;
$function$;

create function public.check_platform_invite_email(
  p_token_hash_hex text,
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.platform_invites%rowtype;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
begin
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or pg_catalog.char_length(normalized_email) > 254 then
    return false;
  end if;

  select stored_invite.* into invite
  from public.platform_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex');
  if not found or invite.revoked_at is not null or invite.redeemed_at is not null
    or invite.expires_at <= pg_catalog.statement_timestamp() then
    return false;
  end if;
  if not public.consume_platform_invite_rate_limit('preview', invite.id, null) then
    return false;
  end if;

  return invite.email is null or invite.email = normalized_email;
end;
$function$;

create function public.accept_platform_invite(
  p_token_hash_hex text,
  p_restaurant_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  account_email text;
  invite public.platform_invites%rowtype;
  invite_status text;
  normalized_name text := pg_catalog.btrim(coalesce(p_restaurant_name, ''));
  slug_base text;
  slug_candidate text;
  new_restaurant_id uuid;
  attempt integer;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or pg_catalog.char_length(normalized_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'invalid_invite_acceptance';
  end if;

  select stored_invite.* into invite
  from public.platform_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex')
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  invite_status := case
    when invite.revoked_at is not null then 'revoked'
    when invite.redeemed_at is not null then 'redeemed'
    when invite.expires_at <= pg_catalog.statement_timestamp() then 'expired'
    else 'pending'
  end;

  if invite_status = 'redeemed' and invite.redeemed_by = actor_id
    and invite.restaurant_id is not null then
    return (
      select pg_catalog.jsonb_build_object(
        'ok', true,
        'alreadyAccepted', true,
        'restaurantId', restaurant.id,
        'restaurantName', restaurant.name,
        'restaurantSlug', restaurant.slug,
        'restaurantStatus', restaurant.status
      )
      from public.restaurants as restaurant
      where restaurant.id = invite.restaurant_id
    );
  end if;
  if invite_status <> 'pending' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  if not public.consume_platform_invite_rate_limit('accept', null, actor_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into account_email
  from auth.users as auth_user
  where auth_user.id = actor_id;
  if account_email is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  if invite.email is not null and invite.email <> account_email then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'email_mismatch');
  end if;

  slug_base := pg_catalog.regexp_replace(
    pg_catalog.translate(
      pg_catalog.lower(normalized_name),
      'áàãâäéèêëíìîïóòõôöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  slug_base := pg_catalog.btrim(
    pg_catalog.left(pg_catalog.btrim(slug_base, '-'), 80),
    '-'
  );
  if slug_base = '' then
    slug_base := 'restaurante';
  end if;

  for attempt in 1..4 loop
    if attempt = 1 then
      slug_candidate := slug_base;
    else
      slug_candidate := pg_catalog.left(slug_base, 80) || '-'
        || pg_catalog.substr(
          pg_catalog.replace(gen_random_uuid()::text, '-', ''),
          1,
          8
        );
    end if;

    insert into public.restaurants (name, slug, status)
    values (normalized_name, slug_candidate, 'draft')
    on conflict (slug) do nothing
    returning id into new_restaurant_id;

    exit when new_restaurant_id is not null;
  end loop;

  if new_restaurant_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'slug_unavailable');
  end if;

  insert into public.memberships (restaurant_id, user_id, position, status)
  values (new_restaurant_id, actor_id, 'Administrador', 'active');

  update public.platform_invites as stored_invite
  set redeemed_at = pg_catalog.statement_timestamp(),
      redeemed_by = actor_id,
      restaurant_id = new_restaurant_id
  where stored_invite.id = invite.id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'platform_invite.redeemed',
    'platform_invite',
    invite.id,
    pg_catalog.jsonb_build_object(
      'restaurantId', new_restaurant_id,
      'restaurantStatus', 'draft'
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'alreadyAccepted', false,
    'restaurantId', new_restaurant_id,
    'restaurantName', normalized_name,
    'restaurantSlug', slug_candidate,
    'restaurantStatus', 'draft'
  );
end;
$function$;

revoke all on function public.consume_platform_invite_rate_limit(text, uuid, uuid) from PUBLIC, anon, authenticated;
revoke all on function public.list_platform_invites(text, text, integer, integer) from PUBLIC, anon, authenticated;
revoke all on function public.create_platform_invite(text, integer, text, uuid) from PUBLIC, anon, authenticated;
revoke all on function public.replace_platform_invite(uuid, text, integer, text, uuid) from PUBLIC, anon, authenticated;
revoke all on function public.revoke_platform_invite(uuid) from PUBLIC, anon, authenticated;
revoke all on function public.preview_platform_invite(text) from PUBLIC, anon, authenticated;
revoke all on function public.check_platform_invite_email(text, text) from PUBLIC, anon, authenticated;
revoke all on function public.accept_platform_invite(text, text) from PUBLIC, anon, authenticated;

grant execute on function public.list_platform_invites(text, text, integer, integer) to authenticated;
grant execute on function public.create_platform_invite(text, integer, text, uuid) to authenticated;
grant execute on function public.replace_platform_invite(uuid, text, integer, text, uuid) to authenticated;
grant execute on function public.revoke_platform_invite(uuid) to authenticated;
grant execute on function public.preview_platform_invite(text) to anon, authenticated;
grant execute on function public.check_platform_invite_email(text, text) to anon, authenticated;
grant execute on function public.accept_platform_invite(text, text) to authenticated;

comment on function public.list_platform_invites(text, text, integer, integer) is
  'Lista convites da plataforma com filtros, página e contagens globais, validando o Admin da sessão.';
comment on function public.create_platform_invite(text, integer, text, uuid) is
  'Cria convite e auditoria na mesma transação; recebe somente o hash do token.';
comment on function public.replace_platform_invite(uuid, text, integer, text, uuid) is
  'Substitui convite pendente/vencido, invalida o anterior e audita atomicamente.';
comment on function public.revoke_platform_invite(uuid) is
  'Revoga somente convite pendente e grava auditoria atomicamente.';
comment on function public.preview_platform_invite(text) is
  'Valida um convite sem consumi-lo e não revela e-mail ou motivo específico de indisponibilidade.';
comment on function public.accept_platform_invite(text, text) is
  'Resgata convite, cria restaurante draft, primeira membership e auditoria em uma transação.';
