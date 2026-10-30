-- Preflight da disponibilidade e validação definitiva de nome/slug no aceite.

create function public.platform_restaurant_slug(p_restaurant_name text)
returns text
language plpgsql
immutable
strict
parallel safe
set search_path = ''
as $function$
declare
  slug_value text;
begin
  slug_value := pg_catalog.regexp_replace(
    pg_catalog.translate(
      pg_catalog.lower(pg_catalog.btrim(p_restaurant_name)),
      'áàãâäéèêëíìîïóòõôöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  slug_value := pg_catalog.btrim(
    pg_catalog.left(pg_catalog.btrim(slug_value, '-'), 80),
    '-'
  );

  if slug_value = '' then
    return 'restaurante';
  end if;

  return slug_value;
end;
$function$;

create index restaurants_normalized_name_idx
  on public.restaurants (pg_catalog.lower(pg_catalog.btrim(name)));

create function public.check_platform_invite_restaurant_name(
  p_token_hash_hex text,
  p_restaurant_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.platform_invites%rowtype;
  normalized_name text := pg_catalog.btrim(coalesce(p_restaurant_name, ''));
  normalized_slug text;
  name_or_slug_taken boolean;
begin
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or pg_catalog.char_length(normalized_name) not between 2 and 120 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select stored_invite.* into invite
  from public.platform_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex');

  if not found or invite.revoked_at is not null or invite.redeemed_at is not null
    or invite.expires_at <= pg_catalog.statement_timestamp() then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  if not public.consume_platform_invite_rate_limit('preview', invite.id, null) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  normalized_slug := public.platform_restaurant_slug(normalized_name);
  select exists (
    select 1
    from public.restaurants as restaurant
    where pg_catalog.lower(pg_catalog.btrim(restaurant.name))
        = pg_catalog.lower(normalized_name)
      or restaurant.slug = normalized_slug
  ) into name_or_slug_taken;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'available', not name_or_slug_taken,
    'slug', normalized_slug
  );
end;
$function$;

create or replace function public.accept_platform_invite(
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
  slug_candidate text;
  name_or_slug_taken boolean;
  new_restaurant_id uuid;
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

  slug_candidate := public.platform_restaurant_slug(normalized_name);
  select exists (
    select 1
    from public.restaurants as restaurant
    where pg_catalog.lower(pg_catalog.btrim(restaurant.name))
        = pg_catalog.lower(normalized_name)
      or restaurant.slug = slug_candidate
  ) into name_or_slug_taken;

  if name_or_slug_taken then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'slug_unavailable');
  end if;

  insert into public.restaurants (name, slug, status)
  values (normalized_name, slug_candidate, 'draft')
  on conflict (slug) do nothing
  returning id into new_restaurant_id;

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

revoke all on function public.platform_restaurant_slug(text) from PUBLIC, anon, authenticated;
revoke all on function public.check_platform_invite_restaurant_name(text, text) from PUBLIC, anon, authenticated;
revoke all on function public.accept_platform_invite(text, text) from PUBLIC, anon, authenticated;

grant execute on function public.check_platform_invite_restaurant_name(text, text) to anon, authenticated;
grant execute on function public.accept_platform_invite(text, text) to authenticated;

comment on function public.check_platform_invite_restaurant_name(text, text) is
  'Confere nome e slug sugerida para convite válido sem reservar o nome nem revelar dados do restaurante.';
comment on function public.platform_restaurant_slug(text) is
  'Normaliza o slug-base de restaurante de forma compartilhada entre prévia e aceite.';
comment on function public.accept_platform_invite(text, text) is
  'Resgata convite, valida nome e slug, cria restaurante draft, primeira membership e auditoria em uma transação.';
