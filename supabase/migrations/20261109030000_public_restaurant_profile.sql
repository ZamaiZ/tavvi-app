-- A identidade pública é consultada por uma função estreita; a tabela
-- restaurants continua sem leitura anônima.
create or replace function public.platform_restaurant_slug(p_restaurant_name text)
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
    slug_value := 'restaurante';
  end if;

  if slug_value in ('admin', 'painel') then
    return slug_value || '-restaurante';
  end if;

  return slug_value;
end;
$function$;

create or replace function public.update_platform_restaurant_slug(
  p_restaurant_id uuid,
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_slug text;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;

  if p_slug is null or pg_catalog.char_length(p_slug) not between 1 and 80
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'invalid_restaurant_slug';
  end if;

  if p_slug in ('admin', 'painel') then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'slug_unavailable');
  end if;

  select restaurant.slug
  into current_slug
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if current_slug = p_slug then
    return pg_catalog.jsonb_build_object('ok', true, 'slug', current_slug);
  end if;

  begin
    update public.restaurants as restaurant
    set slug = p_slug
    where restaurant.id = p_restaurant_id;
  exception
    when unique_violation then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'slug_unavailable');
  end;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'restaurant.slug_changed',
    'restaurant',
    p_restaurant_id,
    pg_catalog.jsonb_build_object('slug', p_slug)
  );

  return pg_catalog.jsonb_build_object('ok', true, 'slug', p_slug);
end;
$function$;

-- restaurants usa remoção física; um arquivo só permanece público enquanto
-- seu caminho ainda estiver referenciado por um registro ativo.
create or replace function public.panel_brand_public_active(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    object_name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
    and exists (
      select 1
      from public.restaurants as restaurant
      where restaurant.status = 'active'
        and (
          restaurant.logo_path = object_name
          or restaurant.cover_path = object_name
        )
    ),
    false
  );
$function$;

revoke all on function public.panel_brand_public_active(text) from public, anon, authenticated;
grant execute on function public.panel_brand_public_active(text) to anon;

create or replace function public.get_public_restaurant_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'slug', restaurant.slug,
    'name', restaurant.name,
    'description', restaurant.description,
    'segment', restaurant.segment,
    'logo_path', restaurant.logo_path,
    'cover_path', restaurant.cover_path,
    'contact', restaurant.contact,
    'theme', restaurant.theme
  )
  from public.restaurants as restaurant
  where p_slug is not null
    and pg_catalog.char_length(p_slug) between 1 and 80
    and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and p_slug not in ('admin', 'painel')
    and restaurant.slug = p_slug
    and restaurant.status = 'active'
  limit 1;
$function$;

revoke all on function public.get_public_restaurant_profile(text) from public, anon, authenticated;
grant execute on function public.get_public_restaurant_profile(text) to anon, authenticated;
