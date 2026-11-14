create table public.team_invites (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null,
  role text not null,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  constraint team_invites_email_normalized_check
    check (email = pg_catalog.lower(pg_catalog.btrim(email))),
  constraint team_invites_email_length_check
    check (pg_catalog.char_length(email) between 3 and 254),
  constraint team_invites_email_shape_check
    check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint team_invites_role_check
    check (role in ('admin', 'cashier', 'attendant', 'waiter')),
  constraint team_invites_token_hash_length_check
    check (pg_catalog.octet_length(token_hash) = 32),
  constraint team_invites_expiration_check
    check (expires_at > created_at),
  constraint team_invites_resolution_check
    check (not (redeemed_at is not null and revoked_at is not null))
);

comment on table public.team_invites is
  'Convites de uso único que associam uma conta existente ou nova a um restaurante.';

create index team_invites_restaurant_created_idx
  on public.team_invites (restaurant_id, created_at desc, id desc);

create index team_invites_restaurant_email_idx
  on public.team_invites (restaurant_id, email);

create unique index team_invites_one_unresolved_email_idx
  on public.team_invites (restaurant_id, email)
  where redeemed_at is null and revoked_at is null;

alter table public.team_invites enable row level security;
revoke all on table public.team_invites from PUBLIC, anon, authenticated;

create function public.list_panel_team(
  p_restaurant_id uuid,
  p_search text,
  p_status text,
  p_page integer,
  p_page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_search text := pg_catalog.btrim(coalesce(p_search, ''));
  actor_role text;
  result jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_restaurant_id is null
    or p_status is null
    or p_status not in ('all', 'active', 'pending')
    or p_page is null
    or p_page not between 1 and 100000
    or p_page_size is null
    or p_page_size not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid_team_query';
  end if;

  select membership.role into actor_role
  from public.memberships as membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_id
    and membership.status = 'active';
  if actor_role is null then
    raise exception using errcode = '42501', message = 'active_restaurant_membership_required';
  end if;

  with all_rows as (
    select
      membership.id,
      membership.user_id,
      'member'::text as kind,
      coalesce(
        nullif(auth_user.raw_user_meta_data ->> 'display_name', ''),
        nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
        nullif(auth_user.raw_user_meta_data ->> 'name', ''),
        nullif(pg_catalog.split_part(coalesce(auth_user.email, ''), '@', 1), ''),
        'Pessoa da equipe'
      ) as name,
      coalesce(pg_catalog.lower(pg_catalog.btrim(auth_user.email)), '') as email,
      membership.role,
      'active'::text as status,
      membership.created_at,
      null::timestamptz as expires_at
    from public.memberships as membership
    join auth.users as auth_user on auth_user.id = membership.user_id
    where membership.restaurant_id = p_restaurant_id
      and membership.status = 'active'

    union all

    select
      invite.id,
      null::uuid as user_id,
      'invite'::text as kind,
      invite.email as name,
      invite.email,
      invite.role,
      'pending'::text as status,
      invite.created_at,
      invite.expires_at
    from public.team_invites as invite
    where invite.restaurant_id = p_restaurant_id
      and invite.redeemed_at is null
      and invite.revoked_at is null
      and invite.expires_at > pg_catalog.statement_timestamp()
  ), filtered as (
    select *
    from all_rows
    where (p_status = 'all' or status = p_status)
      and (
        normalized_search = ''
        or pg_catalog.strpos(pg_catalog.lower(name), pg_catalog.lower(normalized_search)) > 0
        or pg_catalog.strpos(pg_catalog.lower(email), pg_catalog.lower(normalized_search)) > 0
      )
  )
  select pg_catalog.jsonb_build_object(
    'rows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', page_row.id,
          'userId', page_row.user_id,
          'kind', page_row.kind,
          'name', page_row.name,
          'email', page_row.email,
          'role', page_row.role,
          'status', page_row.status,
          'createdAt', page_row.created_at,
          'expiresAt', page_row.expires_at
        ) order by page_row.created_at desc, page_row.id desc
      )
      from (
        select *
        from filtered
        order by created_at desc, id desc
        limit p_page_size
        offset ((p_page - 1) * p_page_size)
      ) as page_row
    ), '[]'::jsonb),
    'totalRows', (select pg_catalog.count(*) from filtered),
    'activeCount', (select pg_catalog.count(*) from all_rows where status = 'active'),
    'pendingCount', (select pg_catalog.count(*) from all_rows where status = 'pending'),
    'page', p_page,
    'pageSize', p_page_size,
    'actorId', actor_id,
    'actorRole', actor_role
  ) into result;

  return result;
end;
$function$;

revoke all on function public.list_panel_team(uuid, text, text, integer, integer) from PUBLIC, anon;
grant execute on function public.list_panel_team(uuid, text, text, integer, integer) to authenticated;

create function public.create_panel_team_invite(
  p_restaurant_id uuid,
  p_email text,
  p_role text,
  p_token_hash_hex text,
  p_valid_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  new_invite public.team_invites%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_restaurant_id is null
    or pg_catalog.char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_role is null
    or p_role not in ('admin', 'cashier', 'attendant', 'waiter')
    or p_token_hash_hex is null
    or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or p_valid_days not between 1 and 30 then
    raise exception using errcode = '22023', message = 'invalid_team_invite';
  end if;

  perform restaurant.id
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  if not exists (
    select 1
    from public.memberships as membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active_restaurant_membership_required';
  end if;

  if exists (
    select 1
    from auth.users as auth_user
    join public.memberships as membership
      on membership.user_id = auth_user.id
     and membership.restaurant_id = p_restaurant_id
     and membership.status = 'active'
    where pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = normalized_email
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'already_member');
  end if;

  update public.team_invites as invite
  set revoked_at = pg_catalog.statement_timestamp()
  where invite.restaurant_id = p_restaurant_id
    and invite.email = normalized_email
    and invite.redeemed_at is null
    and invite.revoked_at is null;

  insert into public.team_invites (
    restaurant_id,
    email,
    role,
    token_hash,
    created_by,
    expires_at
  ) values (
    p_restaurant_id,
    normalized_email,
    p_role,
    pg_catalog.decode(p_token_hash_hex, 'hex'),
    actor_id,
    pg_catalog.statement_timestamp() + pg_catalog.make_interval(days => p_valid_days)
  )
  returning * into new_invite;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'team_invite.created',
    'team_invite',
    new_invite.id,
    pg_catalog.jsonb_build_object(
      'restaurantId', p_restaurant_id,
      'email', normalized_email,
      'role', p_role,
      'expiresAt', new_invite.expires_at
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'inviteId', new_invite.id,
    'expiresAt', new_invite.expires_at
  );
end;
$function$;

revoke all on function public.create_panel_team_invite(uuid, text, text, text, integer) from PUBLIC, anon;
grant execute on function public.create_panel_team_invite(uuid, text, text, text, integer) to authenticated;

create function public.revoke_panel_team_invite(
  p_restaurant_id uuid,
  p_invite_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  changed_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_restaurant_id is null or p_invite_id is null then
    raise exception using errcode = '22023', message = 'invalid_team_invite';
  end if;

  perform restaurant.id
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;
  if not found or not exists (
    select 1
    from public.memberships as membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active_restaurant_membership_required';
  end if;

  update public.team_invites as invite
  set revoked_at = pg_catalog.statement_timestamp()
  where invite.id = p_invite_id
    and invite.restaurant_id = p_restaurant_id
    and invite.redeemed_at is null
    and invite.revoked_at is null
  returning invite.id into changed_id;

  if changed_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'team_invite.revoked',
    'team_invite',
    changed_id,
    pg_catalog.jsonb_build_object('restaurantId', p_restaurant_id)
  );

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.revoke_panel_team_invite(uuid, uuid) from PUBLIC, anon;
grant execute on function public.revoke_panel_team_invite(uuid, uuid) to authenticated;

create function public.preview_team_invite(p_token_hash_hex text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.team_invites%rowtype;
  restaurant_name text;
begin
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  select stored_invite.* into invite
  from public.team_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex');

  if not found
    or invite.revoked_at is not null
    or invite.redeemed_at is not null
    or invite.expires_at <= pg_catalog.statement_timestamp() then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  select restaurant.name into restaurant_name
  from public.restaurants as restaurant
  where restaurant.id = invite.restaurant_id;

  if restaurant_name is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'email', invite.email,
    'role', invite.role,
    'restaurantName', restaurant_name,
    'expiresAt', invite.expires_at
  );
end;
$function$;

revoke all on function public.preview_team_invite(text) from PUBLIC;
grant execute on function public.preview_team_invite(text) to anon, authenticated;

create function public.check_team_invite_email(
  p_token_hash_hex text,
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.team_invites as invite
    where invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex')
      and invite.email = pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')))
      and invite.redeemed_at is null
      and invite.revoked_at is null
      and invite.expires_at > pg_catalog.statement_timestamp()
  );
end;
$function$;

revoke all on function public.check_team_invite_email(text, text) from PUBLIC;
grant execute on function public.check_team_invite_email(text, text) to anon, authenticated;

create function public.accept_team_invite(p_token_hash_hex text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  account_email text;
  invite public.team_invites%rowtype;
  restaurant_record public.restaurants%rowtype;
  affected_rows integer;
  role_label text;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_team_invite';
  end if;

  select stored_invite.* into invite
  from public.team_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex')
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  if invite.redeemed_at is not null and invite.redeemed_by = actor_id then
    select stored_restaurant.* into restaurant_record
    from public.restaurants as stored_restaurant
    where stored_restaurant.id = invite.restaurant_id;
    if not found then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'alreadyAccepted', true,
      'restaurantId', restaurant_record.id,
      'restaurantName', restaurant_record.name,
      'restaurantSlug', restaurant_record.slug,
      'restaurantStatus', restaurant_record.status
    );
  end if;

  if invite.revoked_at is not null
    or invite.redeemed_at is not null
    or invite.expires_at <= pg_catalog.statement_timestamp() then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  perform restaurant.id
  from public.restaurants as restaurant
  where restaurant.id = invite.restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into account_email
  from auth.users as auth_user
  where auth_user.id = actor_id;
  if account_email is null or account_email <> invite.email then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'email_mismatch');
  end if;

  if exists (
    select 1
    from public.memberships as membership
    where membership.restaurant_id = invite.restaurant_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) then
    update public.team_invites as stored_invite
    set redeemed_at = pg_catalog.statement_timestamp(),
        redeemed_by = actor_id
    where stored_invite.id = invite.id;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'already_member');
  end if;

  role_label := case invite.role
    when 'admin' then 'Administrador'
    when 'cashier' then 'Caixa'
    when 'attendant' then 'Atendente'
    else 'Garçom'
  end;

  insert into public.memberships as existing_membership (restaurant_id, user_id, position, role, status)
  values (invite.restaurant_id, actor_id, role_label, invite.role, 'active')
  on conflict (restaurant_id, user_id)
  do update set
    position = excluded.position,
    role = excluded.role,
    status = 'active'
  where existing_membership.status = 'removed';
  get diagnostics affected_rows = row_count;

  if affected_rows = 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'already_member');
  end if;

  update public.team_invites as stored_invite
  set redeemed_at = pg_catalog.statement_timestamp(),
      redeemed_by = actor_id
  where stored_invite.id = invite.id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'team_invite.redeemed',
    'team_invite',
    invite.id,
    pg_catalog.jsonb_build_object(
      'restaurantId', invite.restaurant_id,
      'role', invite.role
    )
  );

  select stored_restaurant.* into restaurant_record
  from public.restaurants as stored_restaurant
  where stored_restaurant.id = invite.restaurant_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'alreadyAccepted', false,
    'restaurantId', restaurant_record.id,
    'restaurantName', restaurant_record.name,
    'restaurantSlug', restaurant_record.slug,
    'restaurantStatus', restaurant_record.status
  );
end;
$function$;

revoke all on function public.accept_team_invite(text) from PUBLIC, anon;
grant execute on function public.accept_team_invite(text) to authenticated;

create function public.update_panel_team_member_role(
  p_restaurant_id uuid,
  p_membership_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  target public.memberships%rowtype;
  next_label text;
  admin_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_restaurant_id is null
    or p_membership_id is null
    or p_role is null
    or p_role not in ('admin', 'cashier', 'attendant', 'waiter') then
    raise exception using errcode = '22023', message = 'invalid_team_role';
  end if;

  perform restaurant.id
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;
  if not found or not public.panel_is_restaurant_admin(p_restaurant_id) then
    raise exception using errcode = '42501', message = 'restaurant_admin_required';
  end if;

  select membership.* into target
  from public.memberships as membership
  where membership.id = p_membership_id
    and membership.restaurant_id = p_restaurant_id
    and membership.status = 'active'
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'member_unavailable');
  end if;
  if target.user_id = actor_id and p_role <> 'admin' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'self_role_change_blocked');
  end if;
  if target.role = p_role then
    return pg_catalog.jsonb_build_object('ok', true, 'role', p_role);
  end if;

  if target.role = 'admin' and p_role <> 'admin' then
    select pg_catalog.count(*) into admin_count
    from public.memberships as membership
    where membership.restaurant_id = p_restaurant_id
      and membership.status = 'active'
      and membership.role = 'admin';
    if admin_count <= 1 then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'last_admin');
    end if;
  end if;

  next_label := case p_role
    when 'admin' then 'Administrador'
    when 'cashier' then 'Caixa'
    when 'attendant' then 'Atendente'
    else 'Garçom'
  end;

  update public.memberships as membership
  set role = p_role,
      position = next_label
  where membership.id = p_membership_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'team_member.role_updated',
    'membership',
    p_membership_id,
    pg_catalog.jsonb_build_object(
      'restaurantId', p_restaurant_id,
      'userId', target.user_id,
      'previousRole', target.role,
      'role', p_role
    )
  );

  return pg_catalog.jsonb_build_object('ok', true, 'role', p_role);
end;
$function$;

revoke all on function public.update_panel_team_member_role(uuid, uuid, text) from PUBLIC, anon;
grant execute on function public.update_panel_team_member_role(uuid, uuid, text) to authenticated;

create function public.remove_panel_team_member(
  p_restaurant_id uuid,
  p_membership_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  target public.memberships%rowtype;
  admin_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'authenticated_panel_user_required';
  end if;
  if p_restaurant_id is null or p_membership_id is null then
    raise exception using errcode = '22023', message = 'invalid_team_member';
  end if;

  perform restaurant.id
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;
  if not found or not exists (
    select 1
    from public.memberships as membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active_restaurant_membership_required';
  end if;

  select membership.* into target
  from public.memberships as membership
  where membership.id = p_membership_id
    and membership.restaurant_id = p_restaurant_id
    and membership.status = 'active'
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'member_unavailable');
  end if;
  if target.user_id = actor_id then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'self_removal_blocked');
  end if;

  if target.role = 'admin' then
    select pg_catalog.count(*) into admin_count
    from public.memberships as membership
    where membership.restaurant_id = p_restaurant_id
      and membership.status = 'active'
      and membership.role = 'admin';
    if admin_count <= 1 then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'last_admin');
    end if;
  end if;

  update public.memberships as membership
  set status = 'removed'
  where membership.id = p_membership_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    actor_id,
    'team_member.removed',
    'membership',
    p_membership_id,
    pg_catalog.jsonb_build_object(
      'restaurantId', p_restaurant_id,
      'userId', target.user_id,
      'role', target.role
    )
  );

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.remove_panel_team_member(uuid, uuid) from PUBLIC, anon;
grant execute on function public.remove_panel_team_member(uuid, uuid) to authenticated;
