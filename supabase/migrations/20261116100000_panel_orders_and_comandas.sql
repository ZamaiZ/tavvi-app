create table public.comandas (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_number integer not null check (table_number > 0),
  status text not null default 'open' check (status = 'open'),
  opened_at timestamptz not null default pg_catalog.clock_timestamp(),
  opened_by uuid not null references auth.users (id) on delete restrict,
  unique (id, restaurant_id)
);

create unique index comandas_one_open_per_table_key
  on public.comandas (restaurant_id, table_number)
  where status = 'open';

create index comandas_restaurant_opened_idx
  on public.comandas (restaurant_id, opened_at, id)
  where status = 'open';

create table public.orders (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  comanda_id uuid not null,
  service_call_id uuid references public.service_calls (id) on delete set null,
  request_id uuid not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id, restaurant_id),
  unique (restaurant_id, request_id),
  constraint orders_comanda_same_restaurant
    foreign key (comanda_id, restaurant_id)
    references public.comandas (id, restaurant_id) on delete cascade
);

create index orders_comanda_created_idx
  on public.orders (restaurant_id, comanda_id, created_at, id);

create index orders_service_call_idx
  on public.orders (service_call_id, created_at desc)
  where service_call_id is not null;

create table public.order_items (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null,
  menu_item_id uuid,
  category_name text not null check (char_length(category_name) between 2 and 80),
  item_name text not null check (char_length(item_name) between 2 and 120),
  variant_id uuid,
  variant_name text,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_cents integer not null check (unit_price_cents between 0 and 99999999),
  observations text not null default '' check (char_length(observations) <= 500),
  position integer not null check (position between 0 and 99),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint order_items_order_same_restaurant
    foreign key (order_id, restaurant_id)
    references public.orders (id, restaurant_id) on delete cascade,
  constraint order_items_variant_snapshot_check
    check ((variant_id is null and variant_name is null) or (variant_id is not null and variant_name is not null))
);

create index order_items_order_position_idx
  on public.order_items (restaurant_id, order_id, position, id);

alter table public.order_items
  add constraint order_items_id_restaurant_key unique (id, restaurant_id);

create table public.order_item_additions (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_item_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  quantity integer not null check (quantity between 1 and 99),
  unit_price_cents integer not null check (unit_price_cents between 0 and 99999999),
  position integer not null check (position between 0 and 9),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint order_item_additions_item_same_restaurant
    foreign key (order_item_id, restaurant_id)
    references public.order_items (id, restaurant_id) on delete cascade
);

create index order_item_additions_item_position_idx
  on public.order_item_additions (restaurant_id, order_item_id, position, id);

alter table public.comandas enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_additions enable row level security;

revoke all on public.comandas, public.orders, public.order_items, public.order_item_additions
  from public, anon, authenticated;
grant select on public.comandas, public.orders, public.order_items, public.order_item_additions
  to authenticated;

create policy comandas_select_member on public.comandas
  for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy orders_select_member on public.orders
  for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy order_items_select_member on public.order_items
  for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy order_item_additions_select_member on public.order_item_additions
  for select to authenticated using (public.panel_menu_member(restaurant_id));

create or replace function public.record_panel_order(
  p_restaurant_id uuid,
  p_call_id uuid,
  p_request_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_call public.service_calls%rowtype;
  v_comanda_id uuid;
  v_order_id uuid;
  v_existing_order public.orders%rowtype;
  v_item public.menu_items%rowtype;
  v_variant public.menu_item_variants%rowtype;
  v_category_name text;
  v_item_input jsonb;
  v_addition_input jsonb;
  v_item_id uuid;
  v_variant_id uuid;
  v_item_quantity integer;
  v_item_price integer;
  v_addition_quantity integer;
  v_addition_price integer;
  v_addition_name text;
  v_observations text;
  v_item_order_id uuid;
  v_line_total numeric;
  v_total_cents numeric := 0;
  v_position integer := 0;
  v_addition_position integer;
begin
  if auth.uid() is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;
  if p_restaurant_id is null or p_call_id is null or p_request_id is null
    or pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if pg_catalog.jsonb_array_length(p_items) < 1 or pg_catalog.jsonb_array_length(p_items) > 100 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0)
  );
  select order_row.* into v_existing_order
  from public.orders as order_row
  where order_row.restaurant_id = p_restaurant_id
    and order_row.request_id = p_request_id;
  if found then
    if v_existing_order.created_by <> auth.uid()
      or v_existing_order.service_call_id is distinct from p_call_id then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;

    select coalesce(pg_catalog.sum(
      item.quantity::numeric * item.unit_price_cents
      + item.quantity::numeric * coalesce(additions.total_cents, 0)
    ), 0) into v_total_cents
    from public.order_items as item
    left join lateral (
      select pg_catalog.sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
      from public.order_item_additions as addition
      where addition.order_item_id = item.id
        and addition.restaurant_id = item.restaurant_id
    ) as additions on true
    where item.order_id = v_existing_order.id
      and item.restaurant_id = p_restaurant_id;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'order', pg_catalog.jsonb_build_object(
        'id', v_existing_order.id,
        'comandaId', v_existing_order.comanda_id,
        'totalCents', v_total_cents
      )
    );
  end if;

  select call_row.* into v_call
  from public.service_calls as call_row
  where call_row.id = p_call_id
    and call_row.restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'call_not_found');
  end if;
  if v_call.status <> 'in_progress' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'call_conflict');
  end if;
  if v_call.claimed_by is distinct from auth.uid() then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_assignee');
  end if;

  begin
  select comanda.id into v_comanda_id
  from public.comandas as comanda
  where comanda.restaurant_id = p_restaurant_id
    and comanda.table_number = v_call.table_number
    and comanda.status = 'open'
  for update;

  if v_comanda_id is null then
    begin
      insert into public.comandas (restaurant_id, table_number, opened_by)
      values (p_restaurant_id, v_call.table_number, auth.uid())
      returning id into v_comanda_id;
    exception when unique_violation then
      select comanda.id into v_comanda_id
      from public.comandas as comanda
      where comanda.restaurant_id = p_restaurant_id
        and comanda.table_number = v_call.table_number
        and comanda.status = 'open'
      for update;
      if v_comanda_id is null then
        raise;
      end if;
    end;
  end if;

  begin
    insert into public.orders (restaurant_id, comanda_id, service_call_id, request_id, created_by)
    values (p_restaurant_id, v_comanda_id, p_call_id, p_request_id, auth.uid())
    returning id into v_order_id;
  end;

  for v_item_input in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    if pg_catalog.jsonb_typeof(v_item_input) is distinct from 'object' then
      raise exception using errcode = 'P0001', message = 'invalid_input';
    end if;
    if pg_catalog.jsonb_typeof(v_item_input->'additions') is distinct from 'array' then
      raise exception using errcode = 'P0001', message = 'invalid_input';
    end if;
    if pg_catalog.jsonb_array_length(v_item_input->'additions') > 10 then
      raise exception using errcode = 'P0001', message = 'invalid_input';
    end if;

    v_item_id := (v_item_input->>'menuItemId')::uuid;
    v_variant_id := nullif(v_item_input->>'variantId', '')::uuid;
    v_item_quantity := (v_item_input->>'quantity')::integer;
    v_observations := pg_catalog.btrim(coalesce(v_item_input->>'observations', ''));
    if v_item_quantity is null or v_item_quantity not between 1 and 99 or pg_catalog.char_length(v_observations) > 500 then
      raise exception using errcode = 'P0001', message = 'invalid_input';
    end if;

    select item.* into v_item
    from public.menu_items as item
    join public.menu_categories as category
      on category.id = item.category_id
      and category.restaurant_id = item.restaurant_id
    where item.id = v_item_id
      and item.restaurant_id = p_restaurant_id
      and item.is_visible
      and item.is_available
      and category.is_visible
      and exists (
        select 1 from public.menu_item_media as media
        where media.item_id = item.id and media.restaurant_id = item.restaurant_id
      )
    for share of item, category;
    if not found then
      raise exception using errcode = 'P0001', message = 'item_not_available';
    end if;

    perform 1
    from public.menu_item_media as media
    where media.item_id = v_item.id
      and media.restaurant_id = p_restaurant_id
    limit 1
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'item_not_available';
    end if;

    select category.name into v_category_name
    from public.menu_categories as category
    where category.id = v_item.category_id
      and category.restaurant_id = p_restaurant_id;

    if v_item.price_mode = 'single' then
      if v_variant_id is not null then
        raise exception using errcode = 'P0001', message = 'invalid_input';
      end if;
      v_item_price := v_item.base_price_cents;
    else
      if v_variant_id is null then
        raise exception using errcode = 'P0001', message = 'variant_required';
      end if;
      select variant.* into v_variant
      from public.menu_item_variants as variant
      where variant.id = v_variant_id
        and variant.item_id = v_item.id
        and variant.restaurant_id = p_restaurant_id
        and variant.is_available
      for share;
      if not found then
        raise exception using errcode = 'P0001', message = 'variant_not_available';
      end if;
      v_item_price := v_variant.price_cents;
    end if;

    insert into public.order_items (
      restaurant_id, order_id, menu_item_id, category_name, item_name,
      variant_id, variant_name, quantity, unit_price_cents, observations, position
    )
    values (
      p_restaurant_id, v_order_id, v_item.id, v_category_name, v_item.name,
      v_variant_id, case when v_variant_id is null then null else v_variant.name end,
      v_item_quantity, v_item_price, v_observations, v_position
    )
    returning id into v_item_order_id;

    v_line_total := v_item_quantity::numeric * v_item_price;
    v_addition_position := 0;
    for v_addition_input in select value from pg_catalog.jsonb_array_elements(v_item_input->'additions')
    loop
      if pg_catalog.jsonb_typeof(v_addition_input) is distinct from 'object' then
        raise exception using errcode = 'P0001', message = 'invalid_input';
      end if;
      v_addition_name := pg_catalog.btrim(v_addition_input->>'name');
      v_addition_quantity := (v_addition_input->>'quantity')::integer;
      v_addition_price := (v_addition_input->>'unitPriceCents')::integer;
      if v_addition_name is null or v_addition_quantity is null or v_addition_price is null
        or pg_catalog.char_length(v_addition_name) not between 1 and 80
        or v_addition_quantity not between 1 and 99
        or v_addition_price not between 0 and 99999999 then
        raise exception using errcode = 'P0001', message = 'invalid_input';
      end if;

      insert into public.order_item_additions (
        restaurant_id, order_item_id, name, quantity, unit_price_cents, position
      )
      values (
        p_restaurant_id, v_item_order_id, v_addition_name,
        v_addition_quantity, v_addition_price, v_addition_position
      );
      v_line_total := v_line_total
        + v_item_quantity::numeric * v_addition_quantity * v_addition_price;
      v_addition_position := v_addition_position + 1;
    end loop;

    v_total_cents := v_total_cents + v_line_total;
    v_position := v_position + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'order', pg_catalog.jsonb_build_object(
      'id', v_order_id,
      'comandaId', v_comanda_id,
      'totalCents', v_total_cents
    )
  );
  exception when sqlstate 'P0001' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', sqlerrm);
  when invalid_text_representation or numeric_value_out_of_range then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end;
end;
$function$;

create or replace function public.resolve_service_call(p_call_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_call public.service_calls%rowtype;
begin
  if auth.uid() is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_call_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select call_row.* into v_call
  from public.service_calls as call_row
  where call_row.id = p_call_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not public.panel_menu_member(v_call.restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_call.status <> 'in_progress' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'resolve_conflict');
  end if;
  if v_call.claimed_by is distinct from auth.uid() then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_assignee');
  end if;

  update public.service_calls as call_row
  set status = 'resolved',
      resolved_at = pg_catalog.clock_timestamp(),
      resolved_by = auth.uid()
  where call_row.id = p_call_id
  returning call_row.* into v_call;

  return pg_catalog.jsonb_build_object('ok', true, 'call', pg_catalog.to_jsonb(v_call));
end;
$function$;

create or replace function public.panel_orders_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_restaurant_id uuid;
begin
  v_restaurant_id := case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
  begin
    perform realtime.broadcast_changes(
      'comandas:' || v_restaurant_id::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception when others then
    raise warning 'panel order broadcast failed: %', sqlerrm;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create trigger comandas_broadcast
  after insert or update or delete on public.comandas
  for each row execute function public.panel_orders_broadcast();
create trigger orders_broadcast
  after insert or update or delete on public.orders
  for each row execute function public.panel_orders_broadcast();
create trigger order_items_broadcast
  after insert or update or delete on public.order_items
  for each row execute function public.panel_orders_broadcast();
create trigger order_item_additions_broadcast
  after insert or update or delete on public.order_item_additions
  for each row execute function public.panel_orders_broadcast();

revoke all on function public.record_panel_order(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.record_panel_order(uuid, uuid, uuid, jsonb) to authenticated;
revoke all on function public.panel_orders_broadcast() from public, anon, authenticated;

drop policy if exists comandas_receive_restaurant_topic on realtime.messages;
create policy comandas_receive_restaurant_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^comandas:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.panel_menu_member(pg_catalog.substr((select realtime.topic()), 10)::uuid)
  );

notify pgrst, 'reload schema';
