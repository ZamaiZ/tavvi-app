alter table public.comandas
  alter column table_number drop not null;

alter table public.orders
  add column fulfillment_type text not null default 'dine_in'
    check (fulfillment_type in ('dine_in', 'takeaway')),
  add column display_number bigint
    check (display_number is null or display_number between 1 and 9007199254740991),
  add column customer_name text
    check (customer_name is null or char_length(btrim(customer_name)) between 1 and 120),
  add column request_fingerprint text
    check (request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{32}$'),
  add constraint orders_call_fulfillment_check
    check (service_call_id is null or fulfillment_type = 'dine_in');

create unique index orders_restaurant_display_number_key
  on public.orders (restaurant_id, display_number)
  where display_number is not null;

create table public.panel_counter_order_sequences (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  last_number bigint not null check (last_number between 1 and 9007199254740991)
);

alter table public.panel_counter_order_sequences enable row level security;
revoke all on public.panel_counter_order_sequences from public, anon, authenticated;

create or replace function public.record_panel_order_internal(
  p_restaurant_id uuid,
  p_call_id uuid,
  p_request_id uuid,
  p_items jsonb,
  p_fulfillment_type text,
  p_table_number integer,
  p_customer_name text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_call public.service_calls%rowtype;
  v_comanda_id uuid;
  v_order_id uuid;
  v_existing_order public.orders%rowtype;
  v_effective_table_number integer;
  v_display_number bigint;
  v_customer_name text := nullif(pg_catalog.btrim(p_customer_name), '');
  v_request_fingerprint text;
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
  if v_actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;
  if p_restaurant_id is null or p_request_id is null
    or p_fulfillment_type is null or p_fulfillment_type not in ('dine_in', 'takeaway')
    or pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if pg_catalog.jsonb_array_length(p_items) < 1 or pg_catalog.jsonb_array_length(p_items) > 100 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if (p_call_id is not null and (p_fulfillment_type <> 'dine_in' or p_table_number is not null))
    or (p_table_number is not null and (p_table_number <= 0 or p_fulfillment_type <> 'dine_in'))
    or (v_customer_name is not null and pg_catalog.char_length(v_customer_name) > 120) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  v_request_fingerprint := pg_catalog.md5(
    pg_catalog.jsonb_build_object(
      'callId', p_call_id,
      'fulfillmentType', p_fulfillment_type,
      'tableNumber', p_table_number,
      'customerName', v_customer_name,
      'items', p_items
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0)
  );
  select order_row.* into v_existing_order
  from public.orders as order_row
  where order_row.restaurant_id = p_restaurant_id
    and order_row.request_id = p_request_id;
  if found then
    if v_existing_order.created_by <> v_actor_id
      or v_existing_order.service_call_id is distinct from p_call_id
      or (v_existing_order.request_fingerprint is not null
        and v_existing_order.request_fingerprint <> v_request_fingerprint) then
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
        'totalCents', v_total_cents,
        'displayNumber', v_existing_order.display_number
      )
    );
  end if;

  if p_call_id is not null then
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
    if v_call.claimed_by is distinct from v_actor_id then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_assignee');
    end if;
    v_effective_table_number := v_call.table_number;
  else
    v_effective_table_number := p_table_number;
  end if;

  begin
    if v_effective_table_number is not null then
      select comanda.id into v_comanda_id
      from public.comandas as comanda
      where comanda.restaurant_id = p_restaurant_id
        and comanda.table_number = v_effective_table_number
        and comanda.status = 'open'
      for update;

      if v_comanda_id is null then
        begin
          insert into public.comandas (restaurant_id, table_number, opened_by)
          values (p_restaurant_id, v_effective_table_number, v_actor_id)
          returning id into v_comanda_id;
        exception when unique_violation then
          select comanda.id into v_comanda_id
          from public.comandas as comanda
          where comanda.restaurant_id = p_restaurant_id
            and comanda.table_number = v_effective_table_number
            and comanda.status = 'open'
          for update;
          if v_comanda_id is null then
            raise;
          end if;
        end;
      end if;
    else
      insert into public.panel_counter_order_sequences as counter_sequence (restaurant_id, last_number)
      values (p_restaurant_id, 1)
      on conflict (restaurant_id) do update
        set last_number = counter_sequence.last_number + 1
      returning last_number into v_display_number;

      insert into public.comandas (restaurant_id, table_number, opened_by)
      values (p_restaurant_id, null, v_actor_id)
      returning id into v_comanda_id;
    end if;

    insert into public.orders (
      restaurant_id, comanda_id, service_call_id, request_id, created_by,
      fulfillment_type, display_number, customer_name, request_fingerprint
    ) values (
      p_restaurant_id, v_comanda_id, p_call_id, p_request_id, v_actor_id,
      p_fulfillment_type, v_display_number, v_customer_name, v_request_fingerprint
    )
    returning id into v_order_id;

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
        'totalCents', v_total_cents,
        'displayNumber', v_display_number
      )
    );
  exception when sqlstate 'P0001' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', sqlerrm);
  when invalid_text_representation or numeric_value_out_of_range then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end;
end;
$function$;

create or replace function public.record_panel_order(
  p_restaurant_id uuid,
  p_call_id uuid,
  p_request_id uuid,
  p_items jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $function$
  select public.record_panel_order_internal(
    p_restaurant_id, p_call_id, p_request_id, p_items, 'dine_in', null, null
  );
$function$;

create or replace function public.record_panel_order_with_context(
  p_restaurant_id uuid,
  p_call_id uuid,
  p_request_id uuid,
  p_items jsonb,
  p_fulfillment_type text,
  p_table_number integer,
  p_customer_name text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $function$
  select public.record_panel_order_internal(
    p_restaurant_id, p_call_id, p_request_id, p_items,
    p_fulfillment_type, p_table_number, p_customer_name
  );
$function$;

revoke all on function public.record_panel_order_internal(uuid, uuid, uuid, jsonb, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.record_panel_order(uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.record_panel_order_with_context(uuid, uuid, uuid, jsonb, text, integer, text)
  from public, anon;
grant execute on function public.record_panel_order(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.record_panel_order_with_context(uuid, uuid, uuid, jsonb, text, integer, text)
  to authenticated;

notify pgrst, 'reload schema';
