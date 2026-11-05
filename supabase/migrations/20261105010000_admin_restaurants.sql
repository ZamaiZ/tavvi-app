-- Leituras e operações administrativas seguras da lista de restaurantes.

alter table public.restaurants
  add column status_before_suspension text;

-- Suspensões anteriores à coluna não têm histórico confiável. Rascunho é o
-- retorno seguro porque não publica o restaurante ao restaurar.
update public.restaurants
set status_before_suspension = 'draft'
where status = 'suspended';

alter table public.restaurants
  add constraint restaurants_status_before_suspension_check
  check (
    (
      status = 'suspended'
      and status_before_suspension is not null
      and status_before_suspension in ('draft', 'active')
    )
    or (status <> 'suspended' and status_before_suspension is null)
  );

create function public.list_platform_restaurants(
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
  total_rows integer;
  actual_page integer;
  page_offset integer;
  status_counts jsonb;
  result_rows jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;

  if pg_catalog.char_length(normalized_search) > 120
    or normalized_status not in ('all', 'draft', 'active', 'suspended')
    or requested_page < 1 or requested_page > 1000000
    or requested_page_size < 1 or requested_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid_restaurant_query';
  end if;

  escaped_search := pg_catalog.replace(
    pg_catalog.replace(
      pg_catalog.replace(normalized_search, pg_catalog.chr(92), pg_catalog.chr(92) || pg_catalog.chr(92)),
      '%', pg_catalog.chr(92) || '%'
    ),
    '_', pg_catalog.chr(92) || '_'
  );

  select pg_catalog.jsonb_build_object(
    'all', pg_catalog.count(*),
    'draft', pg_catalog.count(*) filter (where restaurant.status = 'draft'),
    'active', pg_catalog.count(*) filter (where restaurant.status = 'active'),
    'suspended', pg_catalog.count(*) filter (where restaurant.status = 'suspended')
  )
  into status_counts
  from public.restaurants as restaurant;

  select pg_catalog.count(*)
  into total_rows
  from public.restaurants as restaurant
  where (normalized_status = 'all' or restaurant.status = normalized_status)
    and (
      normalized_search = ''
      or pg_catalog.lower(restaurant.name) like '%' || escaped_search || '%' escape pg_catalog.chr(92)
      or pg_catalog.lower(restaurant.slug) like '%' || escaped_search || '%' escape pg_catalog.chr(92)
    );

  actual_page := least(
    requested_page,
    greatest(1, pg_catalog.ceil(total_rows::numeric / requested_page_size)::integer)
  );
  page_offset := (actual_page - 1) * requested_page_size;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', page_row.id,
        'name', page_row.name,
        'slug', page_row.slug,
        'status', page_row.status,
        'statusBeforeSuspension', page_row.status_before_suspension,
        'createdAt', page_row.created_at,
        'updatedAt', page_row.updated_at
      ) order by page_row.created_at desc, page_row.id desc
    ),
    '[]'::jsonb
  )
  into result_rows
  from (
    select
      restaurant.id,
      restaurant.name,
      restaurant.slug,
      restaurant.status,
      restaurant.status_before_suspension,
      restaurant.created_at,
      restaurant.updated_at
    from public.restaurants as restaurant
    where (normalized_status = 'all' or restaurant.status = normalized_status)
      and (
        normalized_search = ''
        or pg_catalog.lower(restaurant.name) like '%' || escaped_search || '%' escape pg_catalog.chr(92)
        or pg_catalog.lower(restaurant.slug) like '%' || escaped_search || '%' escape pg_catalog.chr(92)
      )
    order by restaurant.created_at desc, restaurant.id desc
    limit requested_page_size
    offset page_offset
  ) as page_row;

  return pg_catalog.jsonb_build_object(
    'rows', result_rows,
    'counts', status_counts,
    'totalRows', total_rows,
    'page', actual_page,
    'pageSize', requested_page_size
  );
end;
$function$;

create function public.set_platform_restaurant_status(
  p_restaurant_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  restaurant_row public.restaurants%rowtype;
  next_status text;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;

  if p_action is null or p_action not in ('suspend', 'restore') then
    raise exception using errcode = '22023', message = 'invalid_restaurant_action';
  end if;

  select restaurant.*
  into restaurant_row
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_action = 'suspend' and restaurant_row.status in ('draft', 'active') then
    next_status := restaurant_row.status;

    update public.restaurants as restaurant
    set status = 'suspended',
        status_before_suspension = next_status
    where restaurant.id = p_restaurant_id;

    insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      auth.uid(),
      'restaurant.suspended',
      'restaurant',
      p_restaurant_id,
      pg_catalog.jsonb_build_object('previous_status', next_status)
    );

    restaurant_row.status := 'suspended';
    restaurant_row.status_before_suspension := next_status;
  elsif p_action = 'restore' and restaurant_row.status = 'suspended' then
    next_status := coalesce(restaurant_row.status_before_suspension, 'draft');

    update public.restaurants as restaurant
    set status = next_status,
        status_before_suspension = null
    where restaurant.id = p_restaurant_id;

    insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
    values (
      auth.uid(),
      'restaurant.restored',
      'restaurant',
      p_restaurant_id,
      pg_catalog.jsonb_build_object('restored_status', next_status)
    );

    restaurant_row.status := next_status;
    restaurant_row.status_before_suspension := null;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'id', restaurant_row.id,
    'status', restaurant_row.status,
    'statusBeforeSuspension', restaurant_row.status_before_suspension
  );
end;
$function$;

create function public.update_platform_restaurant_slug(
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

revoke all on function public.list_platform_restaurants(text, text, integer, integer) from PUBLIC, anon, authenticated;
revoke all on function public.set_platform_restaurant_status(uuid, text) from PUBLIC, anon, authenticated;
revoke all on function public.update_platform_restaurant_slug(uuid, text) from PUBLIC, anon, authenticated;

grant execute on function public.list_platform_restaurants(text, text, integer, integer) to authenticated;
grant execute on function public.set_platform_restaurant_status(uuid, text) to authenticated;
grant execute on function public.update_platform_restaurant_slug(uuid, text) to authenticated;

comment on column public.restaurants.status_before_suspension is
  'Situação administrativa anterior a uma suspensão; preservada para restaurar draft ou active sem ativação acidental.';
