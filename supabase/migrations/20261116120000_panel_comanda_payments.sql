alter table public.restaurants
  add column enabled_payment_methods text[] not null
    default array['cash', 'debit', 'credit', 'meal_voucher', 'food_voucher', 'partnership']::text[];

alter table public.restaurants
  add constraint restaurants_enabled_payment_methods_check
    check (
      pg_catalog.cardinality(enabled_payment_methods) between 1 and 6
      and pg_catalog.array_ndims(enabled_payment_methods) = 1
      and enabled_payment_methods <@ array['cash', 'debit', 'credit', 'meal_voucher', 'food_voucher', 'partnership']::text[]
      and pg_catalog.array_position(enabled_payment_methods, null) is null
    );

alter table public.comandas
  drop constraint comandas_status_check,
  add column closed_at timestamptz,
  add column closed_by uuid references auth.users (id) on delete restrict;

alter table public.comandas
  add constraint comandas_status_check check (status in ('open', 'closed')),
  add constraint comandas_closure_fields_check check (
    (status = 'open' and closed_at is null and closed_by is null)
    or (status = 'closed' and closed_at is not null and closed_by is not null)
  );

create index comandas_restaurant_closed_idx
  on public.comandas (restaurant_id, closed_at desc, id desc)
  where status = 'closed';

create table public.comanda_payments (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  comanda_id uuid not null,
  request_id uuid not null,
  amount_cents bigint not null check (amount_cents between 1 and 9007199254740991),
  close_if_paid boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_by_name text not null check (pg_catalog.char_length(pg_catalog.btrim(created_by_name)) between 1 and 120),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id, restaurant_id),
  unique (restaurant_id, request_id),
  constraint comanda_payments_comanda_same_restaurant
    foreign key (comanda_id, restaurant_id)
    references public.comandas (id, restaurant_id) on delete cascade
);

create index comanda_payments_restaurant_comanda_created_idx
  on public.comanda_payments (restaurant_id, comanda_id, created_at, id);

create table public.comanda_payment_splits (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payment_id uuid not null,
  method text not null check (method in ('cash', 'debit', 'credit', 'meal_voucher', 'food_voucher', 'partnership')),
  amount_cents bigint not null check (amount_cents between 1 and 9007199254740991),
  position integer not null check (position between 0 and 5),
  constraint comanda_payment_splits_payment_same_restaurant
    foreign key (payment_id, restaurant_id)
    references public.comanda_payments (id, restaurant_id) on delete cascade,
  unique (payment_id, method),
  unique (payment_id, position)
);

alter table public.comanda_payments enable row level security;
alter table public.comanda_payment_splits enable row level security;

revoke all on public.comanda_payments, public.comanda_payment_splits
  from public, anon, authenticated;
grant select on public.comanda_payments, public.comanda_payment_splits to authenticated;

create policy comanda_payments_select_member on public.comanda_payments
  for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy comanda_payment_splits_select_member on public.comanda_payment_splits
  for select to authenticated using (public.panel_menu_member(restaurant_id));

create function public.update_panel_payment_methods(
  p_restaurant_id uuid,
  p_enabled_methods jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  method_value text;
  enabled_methods text[] := array[]::text[];
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;
  if p_restaurant_id is null
    or p_enabled_methods is null
    or pg_catalog.jsonb_typeof(p_enabled_methods) is distinct from 'array' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if pg_catalog.jsonb_array_length(p_enabled_methods) not between 1 and 6 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  for method_value in
    select pg_catalog.jsonb_array_elements_text(p_enabled_methods)
  loop
    if method_value is null
      or method_value not in ('cash', 'debit', 'credit', 'meal_voucher', 'food_voucher', 'partnership')
      or method_value = any(enabled_methods) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    enabled_methods := pg_catalog.array_append(enabled_methods, method_value);
  end loop;

  update public.restaurants as restaurant
  set enabled_payment_methods = enabled_methods
  where restaurant.id = p_restaurant_id
    and restaurant.status = 'active';

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'enabledMethods', pg_catalog.to_jsonb(enabled_methods)
  );
end;
$function$;

create function public.record_panel_comanda_payment(
  p_restaurant_id uuid,
  p_comanda_id uuid,
  p_request_id uuid,
  p_splits jsonb,
  p_close_if_paid boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  enabled_methods text[];
  method_value text;
  split_value jsonb;
  split_method text;
  split_amount numeric;
  split_position integer := 0;
  seen_methods text[] := array[]::text[];
  request_splits jsonb;
  stored_splits jsonb;
  requested_amount numeric := 0;
  order_total numeric := 0;
  paid_total numeric := 0;
  balance_cents numeric := 0;
  payment_row public.comanda_payments%rowtype;
  comanda_row public.comandas%rowtype;
  payment_id_value uuid;
  actor_name text;
  is_closed boolean := false;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;
  if p_restaurant_id is null
    or p_comanda_id is null
    or p_request_id is null
    or p_close_if_paid is null
    or p_splits is null
    or pg_catalog.jsonb_typeof(p_splits) is distinct from 'array' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if pg_catalog.jsonb_array_length(p_splits) not between 1 and 6 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  for split_value in select pg_catalog.jsonb_array_elements(p_splits)
  loop
    if pg_catalog.jsonb_typeof(split_value) is distinct from 'object'
      or not (split_value ?& array['method', 'amountCents'])
      or (split_value - array['method', 'amountCents']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(split_value -> 'method') is distinct from 'string'
      or pg_catalog.jsonb_typeof(split_value -> 'amountCents') is distinct from 'number'
      or (split_value ->> 'amountCents') !~ '^[0-9]{1,16}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;

    split_method := split_value ->> 'method';
    split_amount := (split_value ->> 'amountCents')::numeric;
    if split_method not in ('cash', 'debit', 'credit', 'meal_voucher', 'food_voucher', 'partnership')
      or split_amount <= 0
      or split_amount > 9007199254740991
      or split_method = any(seen_methods) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    seen_methods := pg_catalog.array_append(seen_methods, split_method);
    requested_amount := requested_amount + split_amount;
  end loop;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'method', split_row.value ->> 'method',
        'amountCents', (split_row.value ->> 'amountCents')::bigint
      ) order by split_row.value ->> 'method'
    ),
    '[]'::jsonb
  ) into request_splits
  from pg_catalog.jsonb_array_elements(p_splits) as split_row(value);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0)
  );

  select existing_payment.* into payment_row
  from public.comanda_payments as existing_payment
  where existing_payment.restaurant_id = p_restaurant_id
    and existing_payment.request_id = p_request_id
  for update;

  if found then
    if payment_row.created_by <> actor_id
      or payment_row.comanda_id <> p_comanda_id
      or payment_row.close_if_paid <> p_close_if_paid then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'method', split_row.method,
          'amountCents', split_row.amount_cents
        ) order by split_row.method
      ),
      '[]'::jsonb
    ) into stored_splits
    from public.comanda_payment_splits as split_row
    where split_row.payment_id = payment_row.id
      and split_row.restaurant_id = p_restaurant_id;

    if stored_splits is distinct from request_splits then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;

    select command_row.* into comanda_row
    from public.comandas as command_row
    where command_row.id = p_comanda_id
      and command_row.restaurant_id = p_restaurant_id
    for update;
    if not found then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found');
    end if;

    select coalesce(pg_catalog.sum(
      item.quantity::numeric * item.unit_price_cents
      + item.quantity::numeric * coalesce(additions.total_cents, 0)
    ), 0) into order_total
    from public.order_items as item
    left join lateral (
      select pg_catalog.sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
      from public.order_item_additions as addition
      where addition.order_item_id = item.id
        and addition.restaurant_id = item.restaurant_id
    ) as additions on true
    join public.orders as order_row
      on order_row.id = item.order_id
      and order_row.restaurant_id = item.restaurant_id
    where order_row.comanda_id = p_comanda_id
      and order_row.restaurant_id = p_restaurant_id;

    select coalesce(pg_catalog.sum(existing_payment.amount_cents), 0)
    into paid_total
    from public.comanda_payments as existing_payment
    where existing_payment.comanda_id = p_comanda_id
      and existing_payment.restaurant_id = p_restaurant_id;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'paymentId', payment_row.id,
      'closed', comanda_row.status = 'closed',
      'paidCents', paid_total,
      'balanceCents', greatest(0, order_total - paid_total)
    );
  end if;

  select restaurant.enabled_payment_methods into enabled_methods
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.status = 'active'
  for share;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  for split_value in select pg_catalog.jsonb_array_elements(p_splits)
  loop
    method_value := split_value ->> 'method';
    if not (method_value = any(enabled_methods)) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_method_disabled');
    end if;
  end loop;

  select command_row.* into comanda_row
  from public.comandas as command_row
  where command_row.id = p_comanda_id
    and command_row.restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found');
  end if;
  if comanda_row.status <> 'open' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_conflict');
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'method', split_row.value ->> 'method',
        'amountCents', (split_row.value ->> 'amountCents')::bigint
      ) order by split_row.value ->> 'method'
    ),
    '[]'::jsonb
  ) into request_splits
  from pg_catalog.jsonb_array_elements(p_splits) as split_row(value);

  select coalesce(pg_catalog.sum(
    item.quantity::numeric * item.unit_price_cents
    + item.quantity::numeric * coalesce(additions.total_cents, 0)
  ), 0) into order_total
  from public.order_items as item
  left join lateral (
    select pg_catalog.sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
    from public.order_item_additions as addition
    where addition.order_item_id = item.id
      and addition.restaurant_id = item.restaurant_id
  ) as additions on true
  join public.orders as order_row
    on order_row.id = item.order_id
    and order_row.restaurant_id = item.restaurant_id
  where order_row.comanda_id = p_comanda_id
    and order_row.restaurant_id = p_restaurant_id;

  select coalesce(pg_catalog.sum(existing_payment.amount_cents), 0)
  into paid_total
  from public.comanda_payments as existing_payment
  where existing_payment.comanda_id = p_comanda_id
    and existing_payment.restaurant_id = p_restaurant_id;

  balance_cents := order_total - paid_total;
  if balance_cents <= 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'balance_already_paid');
  end if;
  if requested_amount > 9007199254740991 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if requested_amount > balance_cents then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_exceeds_balance');
  end if;
  if p_close_if_paid and requested_amount <> balance_cents then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'close_requires_full_payment');
  end if;

  select coalesce(
    nullif(pg_catalog.btrim(profile.display_name), ''),
    nullif(auth_user.raw_user_meta_data ->> 'display_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'name', ''),
    nullif(pg_catalog.split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Pessoa da equipe'
  ) into actor_name
  from auth.users as auth_user
  left join public.profiles as profile on profile.user_id = auth_user.id
  where auth_user.id = actor_id;
  actor_name := coalesce(actor_name, 'Pessoa da equipe');

  insert into public.comanda_payments (
    restaurant_id, comanda_id, request_id, amount_cents, close_if_paid, created_by, created_by_name
  ) values (
    p_restaurant_id, p_comanda_id, p_request_id, requested_amount::bigint,
    p_close_if_paid, actor_id, actor_name
  )
  returning id into payment_id_value;

  for split_value in select pg_catalog.jsonb_array_elements(p_splits)
  loop
    insert into public.comanda_payment_splits (
      restaurant_id, payment_id, method, amount_cents, position
    ) values (
      p_restaurant_id,
      payment_id_value,
      split_value ->> 'method',
      (split_value ->> 'amountCents')::bigint,
      split_position
    );
    split_position := split_position + 1;
  end loop;

  if p_close_if_paid then
    update public.comandas as command_row
    set status = 'closed',
        closed_at = pg_catalog.clock_timestamp(),
        closed_by = actor_id
    where command_row.id = p_comanda_id
      and command_row.restaurant_id = p_restaurant_id
      and command_row.status = 'open';
    is_closed := found;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'paymentId', payment_id_value,
    'closed', is_closed,
    'paidCents', paid_total + requested_amount,
    'balanceCents', balance_cents - requested_amount
  );
end;
$function$;

create function public.close_paid_panel_comanda(
  p_restaurant_id uuid,
  p_comanda_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  comanda_row public.comandas%rowtype;
  order_total numeric := 0;
  paid_total numeric := 0;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired');
  end if;
  if p_restaurant_id is null or p_comanda_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select command_row.* into comanda_row
  from public.comandas as command_row
  where command_row.id = p_comanda_id
    and command_row.restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found');
  end if;
  if comanda_row.status = 'closed' then
    return pg_catalog.jsonb_build_object('ok', true, 'closed', true, 'alreadyClosed', true);
  end if;

  select coalesce(pg_catalog.sum(
    item.quantity::numeric * item.unit_price_cents
    + item.quantity::numeric * coalesce(additions.total_cents, 0)
  ), 0) into order_total
  from public.order_items as item
  left join lateral (
    select pg_catalog.sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
    from public.order_item_additions as addition
    where addition.order_item_id = item.id
      and addition.restaurant_id = item.restaurant_id
  ) as additions on true
  join public.orders as order_row
    on order_row.id = item.order_id
    and order_row.restaurant_id = item.restaurant_id
  where order_row.comanda_id = p_comanda_id
    and order_row.restaurant_id = p_restaurant_id;

  select coalesce(pg_catalog.sum(payment_row.amount_cents), 0)
  into paid_total
  from public.comanda_payments as payment_row
  where payment_row.comanda_id = p_comanda_id
    and payment_row.restaurant_id = p_restaurant_id;

  if order_total <> paid_total then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'code', 'balance_remaining',
      'balanceCents', greatest(0, order_total - paid_total)
    );
  end if;

  update public.comandas as command_row
  set status = 'closed',
      closed_at = pg_catalog.clock_timestamp(),
      closed_by = actor_id
  where command_row.id = p_comanda_id
    and command_row.restaurant_id = p_restaurant_id
    and command_row.status = 'open';

  return pg_catalog.jsonb_build_object('ok', true, 'closed', true, 'alreadyClosed', false);
end;
$function$;

create trigger comanda_payments_broadcast
  after insert or update or delete on public.comanda_payments
  for each row execute function public.panel_orders_broadcast();
create trigger comanda_payment_splits_broadcast
  after insert or update or delete on public.comanda_payment_splits
  for each row execute function public.panel_orders_broadcast();

revoke all on function public.update_panel_payment_methods(uuid, jsonb) from public, anon;
revoke all on function public.record_panel_comanda_payment(uuid, uuid, uuid, jsonb, boolean) from public, anon;
revoke all on function public.close_paid_panel_comanda(uuid, uuid) from public, anon;
grant execute on function public.update_panel_payment_methods(uuid, jsonb) to authenticated;
grant execute on function public.record_panel_comanda_payment(uuid, uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.close_paid_panel_comanda(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
