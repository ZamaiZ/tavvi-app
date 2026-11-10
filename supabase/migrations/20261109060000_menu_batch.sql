-- Transação única para a criação de categorias e itens em lote.
create or replace function public.save_menu_batch(
  p_restaurant_id uuid,
  p_categories jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  category_value jsonb;
  item_value jsonb;
  created_categories uuid[] := array[]::uuid[];
  created_items uuid[] := array[]::uuid[];
  response jsonb;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    raise exception using errcode = '42501', message = 'menu_unauthorized';
  end if;
  if pg_catalog.jsonb_typeof(p_categories) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'menu_invalid_batch';
  end if;
  if pg_catalog.jsonb_array_length(p_categories) > 20
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'menu_invalid_batch';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_categories) as entry(value)
    where pg_catalog.jsonb_typeof(entry.value -> 'id') is distinct from 'string'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_categories) as entry(value)
    group by (entry.value ->> 'id')::uuid
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'menu_duplicate_category_id';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as entry(value)
    where pg_catalog.jsonb_typeof(entry.value -> 'id') is distinct from 'string'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as entry(value)
    group by (entry.value ->> 'id')::uuid
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'menu_duplicate_item_id';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update;

  -- Revalidar após o lock: outra aba pode ter confirmado o mesmo rascunho
  -- enquanto esta chamada aguardava a linha do restaurante.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as entry(value)
    join public.menu_items item on item.id = (entry.value ->> 'id')::uuid
  ) then
    raise exception using errcode = '22023', message = 'menu_batch_item_must_be_new';
  end if;

  for category_value in select value from pg_catalog.jsonb_array_elements(p_categories)
  loop
    if pg_catalog.jsonb_typeof(category_value) is distinct from 'object'
      or pg_catalog.jsonb_typeof(category_value -> 'id') is distinct from 'string'
      or pg_catalog.char_length(pg_catalog.btrim(coalesce(category_value ->> 'name', ''))) not between 2 and 80
      or pg_catalog.char_length(coalesce(category_value ->> 'description', '')) > 300 then
      raise exception using errcode = '22023', message = 'menu_invalid_category';
    end if;
    if exists (select 1 from public.menu_categories where id = (category_value ->> 'id')::uuid) then
      raise exception using errcode = '22023', message = 'menu_invalid_category_id';
    end if;
    insert into public.menu_categories (id, restaurant_id, name, description, is_visible, position)
    values (
      (category_value ->> 'id')::uuid,
      p_restaurant_id,
      pg_catalog.btrim(category_value ->> 'name'),
      coalesce(category_value ->> 'description', ''),
      coalesce((category_value ->> 'isVisible')::boolean, true),
      (select coalesce(max(position) + 1, 0) from public.menu_categories where restaurant_id = p_restaurant_id)
    );
    created_categories := pg_catalog.array_append(created_categories, (category_value ->> 'id')::uuid);
  end loop;

  for item_value in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    if pg_catalog.jsonb_typeof(item_value) is distinct from 'object'
      or pg_catalog.jsonb_typeof(item_value -> 'id') is distinct from 'string'
      or not exists (
        select 1 from public.menu_categories
        where id = (item_value ->> 'categoryId')::uuid and restaurant_id = p_restaurant_id
      ) then
      raise exception using errcode = '22023', message = 'menu_invalid_batch_item';
    end if;
    response := public.save_menu_item(
      p_restaurant_id,
      (item_value ->> 'id')::uuid,
      (item_value ->> 'categoryId')::uuid,
      item_value -> 'payload'
    );
    created_items := pg_catalog.array_append(created_items, (response ->> 'itemId')::uuid);
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'categoryIds', to_jsonb(created_categories),
    'itemIds', to_jsonb(created_items)
  );
end;
$function$;

revoke all on function public.save_menu_batch(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_menu_batch(uuid, jsonb, jsonb) to authenticated;
