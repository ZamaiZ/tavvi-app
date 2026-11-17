alter table public.restaurants
  add column time_zone text not null default 'America/Sao_Paulo';

alter table public.restaurants
  alter column enabled_payment_methods set default
    array['cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher', 'partnership']::text[],
  drop constraint restaurants_enabled_payment_methods_check,
  add constraint restaurants_enabled_payment_methods_check check (
    pg_catalog.cardinality(enabled_payment_methods) between 0 and 7
    and (pg_catalog.cardinality(enabled_payment_methods) = 0 or pg_catalog.array_ndims(enabled_payment_methods) = 1)
    and enabled_payment_methods <@ array['cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher', 'partnership']::text[]
    and pg_catalog.array_position(enabled_payment_methods, null) is null
  );

update public.restaurants as restaurant
set enabled_payment_methods = pg_catalog.array_append(restaurant.enabled_payment_methods, 'pix')
where not ('pix' = any(restaurant.enabled_payment_methods));

create table public.restaurant_custom_payment_methods (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null check (pg_catalog.char_length(pg_catalog.btrim(label)) between 2 and 40),
  kind text not null check (kind in ('cash', 'electronic')),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id, restaurant_id)
);

create unique index restaurant_custom_payment_methods_label_key
  on public.restaurant_custom_payment_methods (restaurant_id, pg_catalog.lower(pg_catalog.btrim(label)));

create table public.cash_sessions (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  business_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_amount_cents bigint not null check (opening_amount_cents between 0 and 9007199254740991),
  opening_count jsonb,
  opened_by uuid not null references auth.users (id) on delete restrict,
  opened_by_name text not null check (pg_catalog.char_length(pg_catalog.btrim(opened_by_name)) between 1 and 120),
  opened_at timestamptz not null default pg_catalog.clock_timestamp(),
  open_request_id uuid not null,
  closing_expected_cents bigint,
  closing_counted_cents bigint,
  closing_difference_cents bigint,
  closing_count jsonb,
  closing_reason text,
  forced_close boolean not null default false,
  closed_by uuid references auth.users (id) on delete restrict,
  closed_by_name text,
  closed_at timestamptz,
  close_request_id uuid,
  unique (id, restaurant_id),
  unique (restaurant_id, open_request_id),
  unique (restaurant_id, close_request_id),
  constraint cash_sessions_close_fields_check check (
    (status = 'open' and closing_expected_cents is null and closing_counted_cents is null and closing_difference_cents is null and closed_by is null and closed_at is null and close_request_id is null)
    or (status = 'closed' and closing_expected_cents is not null and closing_counted_cents is not null and closing_difference_cents is not null and closed_by is not null and closed_by_name is not null and closed_at is not null and close_request_id is not null)
  )
);

create unique index cash_sessions_one_open_per_restaurant_key
  on public.cash_sessions (restaurant_id) where status = 'open';
create unique index cash_sessions_one_business_day_per_restaurant_key
  on public.cash_sessions (restaurant_id, business_date);
create index cash_sessions_restaurant_business_date_idx
  on public.cash_sessions (restaurant_id, business_date desc, opened_at desc, id desc);

create table public.financial_movements (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  cash_session_id uuid,
  request_id uuid not null,
  kind text not null check (kind in ('cash_in', 'cash_out', 'expense')),
  amount_cents bigint not null check (amount_cents between 1 and 9007199254740991),
  expense_category text,
  payment_method text,
  custom_payment_method_id uuid,
  payment_method_label_snapshot text,
  payment_method_kind_snapshot text,
  description text not null check (pg_catalog.char_length(pg_catalog.btrim(description)) between 2 and 300),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_by_name text not null check (pg_catalog.char_length(pg_catalog.btrim(created_by_name)) between 1 and 120),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id, restaurant_id),
  unique (restaurant_id, request_id),
  constraint financial_movements_session_same_restaurant foreign key (cash_session_id, restaurant_id)
    references public.cash_sessions (id, restaurant_id) on delete restrict,
  constraint financial_movements_custom_method_same_restaurant foreign key (custom_payment_method_id, restaurant_id)
    references public.restaurant_custom_payment_methods (id, restaurant_id) on delete restrict,
  constraint financial_movements_shape_check check (
    (kind in ('cash_in', 'cash_out') and cash_session_id is not null and expense_category is null and payment_method is null and custom_payment_method_id is null and payment_method_label_snapshot is null and payment_method_kind_snapshot is null)
    or (kind = 'expense' and expense_category in ('supplies', 'utilities', 'maintenance', 'transport', 'payroll', 'fees', 'other') and payment_method is not null and payment_method_label_snapshot is not null and payment_method_kind_snapshot in ('cash', 'electronic') and (payment_method_kind_snapshot = 'electronic' or cash_session_id is not null))
  ),
  constraint financial_movements_method_shape_check check (
    (custom_payment_method_id is null and payment_method <> 'custom')
    or (custom_payment_method_id is not null and payment_method = 'custom')
  )
);

create index financial_movements_restaurant_created_idx
  on public.financial_movements (restaurant_id, created_at desc, id desc);
create index financial_movements_session_created_idx
  on public.financial_movements (restaurant_id, cash_session_id, created_at, id)
  where cash_session_id is not null;
create index financial_movements_expense_created_idx
  on public.financial_movements (restaurant_id, created_at, expense_category)
  where kind = 'expense';

alter table public.comanda_payments
  add column cash_session_id uuid;
alter table public.comanda_payments
  add constraint comanda_payments_session_same_restaurant foreign key (cash_session_id, restaurant_id)
    references public.cash_sessions (id, restaurant_id) on delete restrict;

create index orders_restaurant_created_finance_idx
  on public.orders (restaurant_id, created_at desc, id desc);
create index comanda_payments_restaurant_created_finance_idx
  on public.comanda_payments (restaurant_id, created_at desc, id desc);

alter table public.comanda_payment_splits
  add column custom_method_id uuid,
  add column method_label_snapshot text,
  add column method_kind_snapshot text,
  add column cash_received_cents bigint,
  add column change_cents bigint,
  drop constraint comanda_payment_splits_method_check,
  drop constraint comanda_payment_splits_payment_id_method_key,
  add constraint comanda_payment_splits_method_check check (method in ('cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher', 'partnership', 'custom')),
  add constraint comanda_payment_splits_custom_method_same_restaurant foreign key (custom_method_id, restaurant_id)
    references public.restaurant_custom_payment_methods (id, restaurant_id) on delete restrict;

update public.comanda_payment_splits as split_row
set method_label_snapshot = case split_row.method
      when 'cash' then 'Dinheiro'
      when 'debit' then 'Débito'
      when 'credit' then 'Crédito'
      when 'meal_voucher' then 'VA'
      when 'food_voucher' then 'VR'
      when 'partnership' then 'Parceria'
      when 'pix' then 'PIX'
    end,
    method_kind_snapshot = case when split_row.method = 'cash' then 'cash' else 'electronic' end,
    cash_received_cents = case when split_row.method = 'cash' then split_row.amount_cents else null end,
    change_cents = case when split_row.method = 'cash' then 0 else null end;

alter table public.comanda_payment_splits
  alter column method_label_snapshot set not null,
  alter column method_kind_snapshot set not null,
  add constraint comanda_payment_splits_method_snapshot_check check (
    (method = 'custom' and custom_method_id is not null and pg_catalog.char_length(pg_catalog.btrim(method_label_snapshot)) between 2 and 40 and method_kind_snapshot in ('cash', 'electronic'))
    or (method <> 'custom' and custom_method_id is null and method_kind_snapshot = case when method = 'cash' then 'cash' else 'electronic' end)
  ),
  add constraint comanda_payment_splits_cash_change_check check (
    (method_kind_snapshot = 'cash' and cash_received_cents is not null and change_cents is not null and cash_received_cents >= amount_cents and change_cents = cash_received_cents - amount_cents)
    or (method_kind_snapshot = 'electronic' and cash_received_cents is null and change_cents is null)
  );

alter table public.comandas
  drop constraint comandas_status_check,
  drop constraint comandas_closure_fields_check,
  add constraint comandas_status_check check (status in ('open', 'pending', 'closed')),
  add constraint comandas_closure_fields_check check (
    (status in ('open', 'pending') and closed_at is null and closed_by is null)
    or (status = 'closed' and closed_at is not null and closed_by is not null)
  );

alter table public.restaurant_custom_payment_methods enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.financial_movements enable row level security;

revoke all on public.restaurant_custom_payment_methods, public.cash_sessions, public.financial_movements
  from public, anon, authenticated;
grant select on public.restaurant_custom_payment_methods, public.cash_sessions, public.financial_movements to authenticated;

create policy restaurant_custom_payment_methods_select_member on public.restaurant_custom_payment_methods
  for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy cash_sessions_select_member on public.cash_sessions
  for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy financial_movements_select_member on public.financial_movements
  for select to authenticated using (public.panel_menu_member(restaurant_id));

create function public.panel_finance_actor_name(p_actor_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    nullif(pg_catalog.btrim(profile.display_name), ''),
    nullif(auth_user.raw_user_meta_data ->> 'display_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'name', ''),
    nullif(pg_catalog.split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Pessoa da equipe'
  )
  from auth.users as auth_user
  left join public.profiles as profile on profile.user_id = auth_user.id
  where auth_user.id = p_actor_id
$function$;

create function public.update_panel_financial_settings(
  p_restaurant_id uuid,
  p_enabled_methods jsonb,
  p_custom_methods jsonb
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
  custom_value jsonb;
  custom_id uuid;
  custom_label text;
  custom_kind text;
  custom_active boolean;
  enabled_methods text[] := array[]::text[];
  seen_custom_ids uuid[] := array[]::uuid[];
  active_custom_count integer := 0;
  saved_custom jsonb := '[]'::jsonb;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_enabled_methods is null or p_custom_methods is null
    or pg_catalog.jsonb_typeof(p_enabled_methods) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_custom_methods) is distinct from 'array' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if pg_catalog.jsonb_array_length(p_enabled_methods) > 7 or pg_catalog.jsonb_array_length(p_custom_methods) > 20 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  for method_value in select pg_catalog.jsonb_array_elements_text(p_enabled_methods)
  loop
    if method_value is null or method_value not in ('cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher', 'partnership')
      or method_value = any(enabled_methods) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    enabled_methods := pg_catalog.array_append(enabled_methods, method_value);
  end loop;

  perform 1 from public.restaurants where id = p_restaurant_id and status = 'active' for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  for custom_value in select pg_catalog.jsonb_array_elements(p_custom_methods)
  loop
    if pg_catalog.jsonb_typeof(custom_value) is distinct from 'object'
      or not (custom_value ?& array['id', 'label', 'kind', 'isActive'])
      or (custom_value - array['id', 'label', 'kind', 'isActive']) <> '{}'::jsonb
      or (custom_value -> 'id' <> 'null'::jsonb and pg_catalog.jsonb_typeof(custom_value -> 'id') is distinct from 'string')
      or pg_catalog.jsonb_typeof(custom_value -> 'label') is distinct from 'string'
      or pg_catalog.jsonb_typeof(custom_value -> 'kind') is distinct from 'string'
      or pg_catalog.jsonb_typeof(custom_value -> 'isActive') is distinct from 'boolean' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    custom_label := pg_catalog.btrim(custom_value ->> 'label');
    custom_kind := custom_value ->> 'kind';
    custom_active := (custom_value ->> 'isActive')::boolean;
    if pg_catalog.char_length(custom_label) not between 2 and 40 or custom_kind not in ('cash', 'electronic') then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    if custom_value ->> 'id' is null or custom_value ->> 'id' = '' then
      if not custom_active then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
      active_custom_count := active_custom_count + 1;
    else
      begin custom_id := (custom_value ->> 'id')::uuid;
      exception when others then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end;
      if custom_id = any(seen_custom_ids) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
      seen_custom_ids := pg_catalog.array_append(seen_custom_ids, custom_id);
      if not exists (select 1 from public.restaurant_custom_payment_methods where id = custom_id and restaurant_id = p_restaurant_id) then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
      end if;
      if custom_active then active_custom_count := active_custom_count + 1; end if;
    end if;
  end loop;

  if pg_catalog.cardinality(enabled_methods) = 0 and active_custom_count = 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  update public.restaurants set enabled_payment_methods = enabled_methods where id = p_restaurant_id;

  for custom_value in select pg_catalog.jsonb_array_elements(p_custom_methods)
  loop
    if pg_catalog.jsonb_typeof(custom_value) is distinct from 'object'
      or not (custom_value ?& array['id', 'label', 'kind', 'isActive'])
      or (custom_value - array['id', 'label', 'kind', 'isActive']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(custom_value -> 'label') is distinct from 'string'
      or pg_catalog.jsonb_typeof(custom_value -> 'kind') is distinct from 'string'
      or pg_catalog.jsonb_typeof(custom_value -> 'isActive') is distinct from 'boolean' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    custom_label := pg_catalog.btrim(custom_value ->> 'label');
    custom_kind := custom_value ->> 'kind';
    custom_active := (custom_value ->> 'isActive')::boolean;
    if pg_catalog.char_length(custom_label) not between 2 and 40 or custom_kind not in ('cash', 'electronic') then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;

    if custom_value ->> 'id' is null or custom_value ->> 'id' = '' then
      custom_id := null;
      if not custom_active then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
      insert into public.restaurant_custom_payment_methods (restaurant_id, label, kind, is_active)
      values (p_restaurant_id, custom_label, custom_kind, true)
      returning id into custom_id;
    else
      begin custom_id := (custom_value ->> 'id')::uuid;
      exception when others then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end;
      update public.restaurant_custom_payment_methods
      set label = custom_label,
          kind = custom_kind,
          is_active = custom_active,
          updated_at = pg_catalog.clock_timestamp()
      where id = custom_id and restaurant_id = p_restaurant_id;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    end if;
  end loop;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('id', id, 'label', label, 'kind', kind, 'isActive', is_active)
    order by created_at, id
  ), '[]'::jsonb) into saved_custom
  from public.restaurant_custom_payment_methods where restaurant_id = p_restaurant_id;

  return pg_catalog.jsonb_build_object('ok', true, 'enabledMethods', pg_catalog.to_jsonb(enabled_methods), 'customMethods', saved_custom);
exception
  when unique_violation then return pg_catalog.jsonb_build_object('ok', false, 'code', 'duplicate_method');
end;
$function$;

create function public.open_panel_cash_session(
  p_restaurant_id uuid,
  p_request_id uuid,
  p_opening_amount_cents bigint,
  p_opening_count jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  restaurant_zone text;
  business_date_value date;
  existing_session public.cash_sessions%rowtype;
  session_id_value uuid;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_request_id is null or p_opening_amount_cents is null
    or p_opening_amount_cents < 0 or p_opening_amount_cents > 9007199254740991 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_restaurant_id::text || ':cash-session', 0));
  select restaurant.time_zone into restaurant_zone from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id and restaurant.status = 'active' for share;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  business_date_value := (pg_catalog.clock_timestamp() at time zone restaurant_zone)::date;

  select session_row.* into existing_session from public.cash_sessions as session_row
  where session_row.restaurant_id = p_restaurant_id and session_row.open_request_id = p_request_id;
  if found then
    if existing_session.opened_by <> actor_id
      or existing_session.opening_amount_cents <> p_opening_amount_cents
      or existing_session.opening_count is distinct from p_opening_count then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'sessionId', existing_session.id, 'alreadyOpen', existing_session.status = 'open');
  end if;

  if exists (
    select 1 from public.cash_sessions as session_row
    where session_row.restaurant_id = p_restaurant_id
      and session_row.business_date = business_date_value
      and session_row.status = 'closed'
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_already_closed_today');
  end if;

  select session_row.id into session_id_value from public.cash_sessions as session_row
  where session_row.restaurant_id = p_restaurant_id and session_row.status = 'open'
  for update;
  if found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_already_open');
  end if;

  actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
  insert into public.cash_sessions (
    restaurant_id, business_date, opening_amount_cents, opening_count, opened_by, opened_by_name, open_request_id
  ) values (
    p_restaurant_id,
    business_date_value,
    p_opening_amount_cents,
    p_opening_count,
    actor_id,
    actor_name,
    p_request_id
  ) returning id into session_id_value;

  return pg_catalog.jsonb_build_object('ok', true, 'sessionId', session_id_value, 'alreadyOpen', false);
end;
$function$;

create function public.record_panel_financial_movement(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_request_id uuid,
  p_kind text,
  p_amount_cents bigint,
  p_expense_category text,
  p_payment_method text,
  p_description text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  custom_id uuid;
  normalized_payment_method text;
  method_label text;
  method_kind text;
  enabled_methods text[];
  movement_id_value uuid;
  session_row public.cash_sessions%rowtype;
  existing_movement public.financial_movements%rowtype;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_request_id is null or p_kind is null or p_kind not in ('cash_in', 'cash_out', 'expense')
    or p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 9007199254740991
    or p_description is null or pg_catalog.char_length(pg_catalog.btrim(p_description)) not between 2 and 300 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  normalized_payment_method := p_payment_method;
  if p_payment_method like 'custom:%' then normalized_payment_method := 'custom'; end if;

  if p_kind = 'expense' and p_payment_method like 'custom:%' then
    begin custom_id := pg_catalog.substring(p_payment_method, 8)::uuid;
    exception when others then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0));
  select movement.* into existing_movement from public.financial_movements as movement
  where movement.restaurant_id = p_restaurant_id and movement.request_id = p_request_id;
  if found then
    if existing_movement.created_by <> actor_id or existing_movement.kind <> p_kind
      or existing_movement.amount_cents <> p_amount_cents
      or existing_movement.cash_session_id is distinct from p_session_id
      or existing_movement.expense_category is distinct from p_expense_category
      or existing_movement.description is distinct from pg_catalog.btrim(p_description)
      or existing_movement.payment_method is distinct from normalized_payment_method
      or existing_movement.custom_payment_method_id is distinct from custom_id then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'movementId', existing_movement.id, 'alreadyRecorded', true);
  end if;

  if p_kind in ('cash_in', 'cash_out') then
    if p_session_id is null or p_expense_category is not null or p_payment_method is not null then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    select session_row.* into session_row from public.cash_sessions as session_row
    where session_row.id = p_session_id and session_row.restaurant_id = p_restaurant_id and session_row.status = 'open'
    for update;
    if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_closed'); end if;
    method_label := null; method_kind := null; custom_id := null;
  else
    if p_expense_category is null or p_expense_category not in ('supplies', 'utilities', 'maintenance', 'transport', 'payroll', 'fees', 'other')
      or p_payment_method is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
    select restaurant.enabled_payment_methods into enabled_methods from public.restaurants as restaurant
    where restaurant.id = p_restaurant_id and restaurant.status = 'active' for share;
    if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if p_payment_method like 'custom:%' then
      select custom_method.label, custom_method.kind into method_label, method_kind
      from public.restaurant_custom_payment_methods as custom_method
      where custom_method.id = custom_id and custom_method.restaurant_id = p_restaurant_id and custom_method.is_active;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_method_disabled'); end if;
    else
      if not (p_payment_method = any(enabled_methods)) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_method_disabled'); end if;
      method_label := case p_payment_method when 'cash' then 'Dinheiro' when 'debit' then 'Débito' when 'credit' then 'Crédito' when 'pix' then 'PIX' when 'meal_voucher' then 'VA' when 'food_voucher' then 'VR' when 'partnership' then 'Parceria' end;
      method_kind := case when p_payment_method = 'cash' then 'cash' else 'electronic' end;
    end if;
    if method_kind = 'cash' then
      if p_session_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_required'); end if;
      select session_row.* into session_row from public.cash_sessions as session_row
      where session_row.id = p_session_id and session_row.restaurant_id = p_restaurant_id and session_row.status = 'open'
      for update;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_closed'); end if;
    else
      if p_session_id is not null then
        select session_row.* into session_row from public.cash_sessions as session_row
        where session_row.id = p_session_id and session_row.restaurant_id = p_restaurant_id and session_row.status = 'open'
        for update;
        if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_closed'); end if;
      end if;
    end if;
  end if;

  actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
  insert into public.financial_movements (
    restaurant_id, cash_session_id, request_id, kind, amount_cents, expense_category,
    payment_method, custom_payment_method_id, payment_method_label_snapshot,
    payment_method_kind_snapshot, description, created_by, created_by_name
  ) values (
    p_restaurant_id, p_session_id, p_request_id, p_kind, p_amount_cents, p_expense_category,
    normalized_payment_method, custom_id,
    method_label, method_kind, pg_catalog.btrim(p_description), actor_id, actor_name
  ) returning id into movement_id_value;

  return pg_catalog.jsonb_build_object('ok', true, 'movementId', movement_id_value, 'alreadyRecorded', false);
end;
$function$;

create function public.close_panel_cash_session(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_request_id uuid,
  p_counted_amount_cents bigint,
  p_closing_count jsonb,
  p_reason text,
  p_force boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  session_row public.cash_sessions%rowtype;
  expected_cents numeric;
  difference_cents numeric;
  open_comandas_count integer := 0;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_session_id is null or p_request_id is null
    or p_counted_amount_cents is null or p_counted_amount_cents < 0 or p_counted_amount_cents > 9007199254740991
    or p_force is null or (p_reason is not null and pg_catalog.char_length(pg_catalog.btrim(p_reason)) > 500) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  select session_row.* into session_row from public.cash_sessions as session_row
  where session_row.id = p_session_id and session_row.restaurant_id = p_restaurant_id
  for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_not_found'); end if;
  if session_row.status = 'closed' then
    if session_row.close_request_id = p_request_id and session_row.closed_by = actor_id
      and session_row.closing_counted_cents = p_counted_amount_cents
      and session_row.closing_count is not distinct from p_closing_count
      and session_row.forced_close = p_force
      and session_row.closing_reason is not distinct from nullif(pg_catalog.btrim(p_reason), '') then
      return pg_catalog.jsonb_build_object('ok', true, 'alreadyClosed', true, 'expectedCents', session_row.closing_expected_cents, 'differenceCents', session_row.closing_difference_cents);
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_closed');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_restaurant_id::text || ':cash-close', 0));
  select count(*)::integer into open_comandas_count from public.comandas as comanda
  where comanda.restaurant_id = p_restaurant_id and comanda.status = 'open';
  if open_comandas_count > 0 and not p_force then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'open_comandas', 'openComandas', open_comandas_count);
  end if;
  if p_force and (p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 3 and 500) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'reason_required');
  end if;

  select session_row.opening_amount_cents
    + coalesce((select pg_catalog.sum(split_row.amount_cents)
      from public.comanda_payments as payment_row
      join public.comanda_payment_splits as split_row
        on split_row.payment_id = payment_row.id and split_row.restaurant_id = payment_row.restaurant_id
      where payment_row.restaurant_id = p_restaurant_id
        and payment_row.cash_session_id = p_session_id
        and split_row.method_kind_snapshot = 'cash'), 0)
    + coalesce((select pg_catalog.sum(movement.amount_cents) from public.financial_movements as movement
      where movement.restaurant_id = p_restaurant_id and movement.cash_session_id = p_session_id and movement.kind = 'cash_in'), 0)
    - coalesce((select pg_catalog.sum(movement.amount_cents) from public.financial_movements as movement
      where movement.restaurant_id = p_restaurant_id and movement.cash_session_id = p_session_id and movement.kind = 'cash_out'), 0)
    - coalesce((select pg_catalog.sum(movement.amount_cents) from public.financial_movements as movement
      where movement.restaurant_id = p_restaurant_id and movement.cash_session_id = p_session_id and movement.kind = 'expense' and movement.payment_method_kind_snapshot = 'cash'), 0)
  into expected_cents;

  difference_cents := p_counted_amount_cents::numeric - expected_cents;
  if difference_cents <> 0 and (p_reason is null or pg_catalog.char_length(pg_catalog.btrim(p_reason)) not between 3 and 500) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'difference_reason_required', 'expectedCents', expected_cents, 'differenceCents', difference_cents);
  end if;
  if expected_cents < 0 or expected_cents > 9007199254740991 or pg_catalog.abs(difference_cents) > 9007199254740991 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow');
  end if;

  if p_force and open_comandas_count > 0 then
    update public.comandas set status = 'pending', table_number = null
    where restaurant_id = p_restaurant_id and status = 'open';
  end if;

  actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
  update public.cash_sessions set
    status = 'closed',
    closing_expected_cents = expected_cents::bigint,
    closing_counted_cents = p_counted_amount_cents,
    closing_difference_cents = difference_cents::bigint,
    closing_count = p_closing_count,
    closing_reason = nullif(pg_catalog.btrim(p_reason), ''),
    forced_close = p_force,
    closed_by = actor_id,
    closed_by_name = actor_name,
    closed_at = pg_catalog.clock_timestamp(),
    close_request_id = p_request_id
  where id = p_session_id and restaurant_id = p_restaurant_id and status = 'open';

  return pg_catalog.jsonb_build_object('ok', true, 'alreadyClosed', false, 'expectedCents', expected_cents, 'differenceCents', difference_cents, 'pendingComandas', open_comandas_count);
end;
$function$;

create function public.get_panel_cash_session(p_restaurant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  session_row public.cash_sessions%rowtype;
  expected_cents numeric;
  restaurant_zone text;
  local_business_date date;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select time_zone into restaurant_zone from public.restaurants where id = p_restaurant_id and status = 'active';
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  local_business_date := (pg_catalog.clock_timestamp() at time zone restaurant_zone)::date;
  select * into session_row from public.cash_sessions where restaurant_id = p_restaurant_id and status = 'open';
  if not found then
    select * into session_row from public.cash_sessions
    where restaurant_id = p_restaurant_id and business_date = local_business_date and status = 'closed'
    order by closed_at desc limit 1;
    if not found then return pg_catalog.jsonb_build_object('ok', true, 'session', null); end if;
  end if;

  select session_row.opening_amount_cents
    + coalesce((select pg_catalog.sum(split_row.amount_cents) from public.comanda_payments as payment_row
      join public.comanda_payment_splits as split_row on split_row.payment_id = payment_row.id and split_row.restaurant_id = payment_row.restaurant_id
      where payment_row.restaurant_id = p_restaurant_id and payment_row.cash_session_id = session_row.id and split_row.method_kind_snapshot = 'cash'), 0)
    + coalesce((select pg_catalog.sum(amount_cents) from public.financial_movements where restaurant_id = p_restaurant_id and cash_session_id = session_row.id and kind = 'cash_in'), 0)
    - coalesce((select pg_catalog.sum(amount_cents) from public.financial_movements where restaurant_id = p_restaurant_id and cash_session_id = session_row.id and kind = 'cash_out'), 0)
    - coalesce((select pg_catalog.sum(amount_cents) from public.financial_movements where restaurant_id = p_restaurant_id and cash_session_id = session_row.id and kind = 'expense' and payment_method_kind_snapshot = 'cash'), 0)
  into expected_cents;

  return pg_catalog.jsonb_build_object('ok', true, 'session', pg_catalog.jsonb_build_object(
    'id', session_row.id, 'status', session_row.status,
    'businessDate', session_row.business_date, 'timeZone', restaurant_zone, 'openedAt', session_row.opened_at,
    'openedByName', session_row.opened_by_name, 'openingAmountCents', session_row.opening_amount_cents,
    'expectedAmountCents', case when session_row.status = 'closed' then session_row.closing_expected_cents else expected_cents end,
    'closedAt', session_row.closed_at, 'closedByName', session_row.closed_by_name,
    'countedAmountCents', session_row.closing_counted_cents,
    'differenceCents', session_row.closing_difference_cents,
    'forcedClose', session_row.forced_close, 'closingReason', session_row.closing_reason
  ));
end;
$function$;

create function public.get_panel_finance_dashboard(p_restaurant_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  restaurant_zone text;
  start_at timestamptz;
  end_at timestamptz;
  result jsonb;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select time_zone into restaurant_zone from public.restaurants where id = p_restaurant_id and status = 'active';
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  start_at := p_from::timestamp at time zone restaurant_zone;
  end_at := (p_to + 1)::timestamp at time zone restaurant_zone;

  with order_totals as (
    select order_row.id, order_row.created_at,
      coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0) as total_cents
    from public.orders as order_row
    join public.order_items as item on item.order_id = order_row.id and item.restaurant_id = order_row.restaurant_id
    left join lateral (
      select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
      from public.order_item_additions as addition
      where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id
    ) as additions on true
    where order_row.restaurant_id = p_restaurant_id and order_row.created_at >= start_at and order_row.created_at < end_at
    group by order_row.id, order_row.created_at
  ),
  payment_totals as (
    select payment_row.id, payment_row.created_at, payment_row.amount_cents,
      coalesce(sum(split_row.amount_cents) filter (where split_row.method_kind_snapshot = 'cash'), 0) as cash_cents
    from public.comanda_payments as payment_row
    left join public.comanda_payment_splits as split_row on split_row.payment_id = payment_row.id and split_row.restaurant_id = payment_row.restaurant_id
    where payment_row.restaurant_id = p_restaurant_id and payment_row.created_at >= start_at and payment_row.created_at < end_at
    group by payment_row.id, payment_row.created_at, payment_row.amount_cents
  ),
  daily as (
    select calendar_day::date as day,
      coalesce((select sum(order_totals.total_cents) from order_totals where (order_totals.created_at at time zone restaurant_zone)::date = calendar_day::date), 0) as sales_cents,
      coalesce((select sum(payment_totals.amount_cents) from payment_totals where (payment_totals.created_at at time zone restaurant_zone)::date = calendar_day::date), 0) as received_cents,
      coalesce((select sum(movement.amount_cents) from public.financial_movements as movement where movement.restaurant_id = p_restaurant_id and movement.kind = 'expense' and movement.created_at >= start_at and movement.created_at < end_at and (movement.created_at at time zone restaurant_zone)::date = calendar_day::date), 0) as expenses_cents
    from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as calendar_day
  ),
  expenses_by_category as (
    select movement.expense_category as category, sum(movement.amount_cents)::numeric as amount_cents
    from public.financial_movements as movement
    where movement.restaurant_id = p_restaurant_id and movement.kind = 'expense' and movement.created_at >= start_at and movement.created_at < end_at
    group by movement.expense_category
  ),
  pending_balances as (
    select comanda.id,
      greatest(0,
        coalesce((select sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0))
          from public.orders as order_row
          join public.order_items as item on item.order_id = order_row.id and item.restaurant_id = order_row.restaurant_id
          left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
          where order_row.comanda_id = comanda.id and order_row.restaurant_id = p_restaurant_id), 0)
        - coalesce((select sum(payment_row.amount_cents) from public.comanda_payments as payment_row where payment_row.comanda_id = comanda.id and payment_row.restaurant_id = p_restaurant_id), 0)
      ) as balance_cents
    from public.comandas as comanda where comanda.restaurant_id = p_restaurant_id and comanda.status in ('open', 'pending')
  ),
  cash_session_totals as (
    select
      count(*) filter (where session_row.status = 'closed')::integer as closed_count,
      count(*) filter (where session_row.status = 'open')::integer as open_count,
      coalesce(sum(session_row.closing_expected_cents) filter (where session_row.status = 'closed'), 0)::numeric as expected_cents,
      coalesce(sum(session_row.closing_counted_cents) filter (where session_row.status = 'closed'), 0)::numeric as counted_cents,
      coalesce(sum(pg_catalog.abs(session_row.closing_difference_cents)) filter (where session_row.status = 'closed'), 0)::numeric as absolute_difference_cents,
      count(*) filter (where session_row.status = 'closed' and session_row.closing_difference_cents <> 0)::integer as difference_count
    from public.cash_sessions as session_row
    where session_row.restaurant_id = p_restaurant_id and session_row.business_date between p_from and p_to
  )
  select jsonb_build_object(
    'ok', true,
    'from', p_from,
    'to', p_to,
    'timeZone', restaurant_zone,
    'salesCents', coalesce((select sum(total_cents) from order_totals), 0),
    'receivedCents', coalesce((select sum(amount_cents) from payment_totals), 0),
    'cashReceivedCents', coalesce((select sum(cash_cents) from payment_totals), 0),
    'expensesCents', coalesce((select sum(amount_cents) from expenses_by_category), 0),
    'cashInCents', coalesce((select sum(amount_cents) from public.financial_movements where restaurant_id = p_restaurant_id and kind = 'cash_in' and created_at >= start_at and created_at < end_at), 0),
    'cashOutCents', coalesce((select sum(amount_cents) from public.financial_movements where restaurant_id = p_restaurant_id and kind = 'cash_out' and created_at >= start_at and created_at < end_at), 0),
    'cashClosingSessionsCount', coalesce((select closed_count from cash_session_totals), 0),
    'cashOpenSessionsCount', coalesce((select open_count from cash_session_totals), 0),
    'cashClosingExpectedCents', coalesce((select expected_cents from cash_session_totals), 0),
    'cashClosingCountedCents', coalesce((select counted_cents from cash_session_totals), 0),
    'cashClosingDifferenceCents', coalesce((select absolute_difference_cents from cash_session_totals), 0),
    'cashDifferenceSessionsCount', coalesce((select difference_count from cash_session_totals), 0),
    'pendingCents', coalesce((select sum(balance_cents) from pending_balances), 0),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'salesCents', sales_cents, 'receivedCents', received_cents, 'expensesCents', expenses_cents) order by day) from daily), '[]'::jsonb),
    'expensesByCategory', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'amountCents', amount_cents) order by amount_cents desc) from expenses_by_category), '[]'::jsonb),
    'expensesByMethod', coalesce((select jsonb_agg(jsonb_build_object('method', grouped.payment_method_label_snapshot, 'amountCents', grouped.amount_cents) order by grouped.amount_cents desc)
      from (select movement.payment_method_label_snapshot, sum(movement.amount_cents)::numeric as amount_cents
        from public.financial_movements as movement
        where movement.restaurant_id = p_restaurant_id and movement.kind = 'expense' and movement.created_at >= start_at and movement.created_at < end_at
        group by movement.payment_method_label_snapshot) as grouped), '[]'::jsonb),
    'receivedByMethod', coalesce((select jsonb_agg(jsonb_build_object('method', grouped.method_label_snapshot, 'amountCents', grouped.amount_cents) order by grouped.amount_cents desc)
      from (select split_row.method_label_snapshot, sum(split_row.amount_cents)::numeric as amount_cents
        from public.comanda_payment_splits as split_row join public.comanda_payments as payment_row on payment_row.id = split_row.payment_id and payment_row.restaurant_id = split_row.restaurant_id
        where split_row.restaurant_id = p_restaurant_id and payment_row.created_at >= start_at and payment_row.created_at < end_at
        group by split_row.method_label_snapshot) as grouped), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

create function public.panel_bind_payment_to_cash_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  session_id_value uuid;
begin
  if new.cash_session_id is null then
    select session_row.id into session_id_value
    from public.cash_sessions as session_row
    where session_row.restaurant_id = new.restaurant_id and session_row.status = 'open'
    for update;
    if not found then raise exception using errcode = 'P0001', message = 'cash_session_required'; end if;
    new.cash_session_id := session_id_value;
  else
    perform 1 from public.cash_sessions as session_row
    where session_row.id = new.cash_session_id and session_row.restaurant_id = new.restaurant_id and session_row.status = 'open'
    for update;
    if not found then raise exception using errcode = 'P0001', message = 'cash_session_closed'; end if;
  end if;
  return new;
end;
$function$;

create trigger comanda_payments_require_open_cash_session
  before insert on public.comanda_payments
  for each row execute function public.panel_bind_payment_to_cash_session();

create function public.panel_snapshot_payment_split()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.method = 'custom' then
    if new.custom_method_id is null then raise exception using errcode = '23514', message = 'custom_payment_method_required'; end if;
    if new.method_label_snapshot is null or new.method_kind_snapshot is null then
      select custom_method.label, custom_method.kind
      into new.method_label_snapshot, new.method_kind_snapshot
      from public.restaurant_custom_payment_methods as custom_method
      where custom_method.id = new.custom_method_id and custom_method.restaurant_id = new.restaurant_id;
    end if;
  else
    new.method_label_snapshot := coalesce(new.method_label_snapshot, case new.method
      when 'cash' then 'Dinheiro' when 'debit' then 'Débito' when 'credit' then 'Crédito'
      when 'pix' then 'PIX' when 'meal_voucher' then 'VA' when 'food_voucher' then 'VR'
      when 'partnership' then 'Parceria' end);
    new.method_kind_snapshot := coalesce(new.method_kind_snapshot, case when new.method = 'cash' then 'cash' else 'electronic' end);
  end if;
  if new.method_kind_snapshot = 'cash' then
    new.cash_received_cents := coalesce(new.cash_received_cents, new.amount_cents);
    new.change_cents := coalesce(new.change_cents, new.cash_received_cents - new.amount_cents);
  else
    new.cash_received_cents := null;
    new.change_cents := null;
  end if;
  return new;
end;
$function$;

create trigger comanda_payment_splits_snapshot
  before insert on public.comanda_payment_splits
  for each row execute function public.panel_snapshot_payment_split();

create function public.record_panel_comanda_payment_v2(
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
  actor_name text;
  enabled_methods text[];
  split_value jsonb;
  split_key text;
  split_method text;
  split_custom_id uuid;
  split_label text;
  split_kind text;
  split_amount numeric;
  split_received numeric;
  split_change numeric;
  split_position integer := 0;
  seen_methods text[] := array[]::text[];
  request_splits jsonb := '[]'::jsonb;
  stored_splits jsonb;
  requested_amount numeric := 0;
  order_total numeric := 0;
  paid_total numeric := 0;
  balance_cents numeric := 0;
  payment_row public.comanda_payments%rowtype;
  comanda_row public.comandas%rowtype;
  session_row public.cash_sessions%rowtype;
  payment_id_value uuid;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_comanda_id is null or p_request_id is null or p_close_if_paid is null
    or p_splits is null or pg_catalog.jsonb_typeof(p_splits) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_splits) not between 1 and 27 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  for split_value in select pg_catalog.jsonb_array_elements(p_splits)
  loop
    if pg_catalog.jsonb_typeof(split_value) is distinct from 'object'
      or not (split_value ?& array['method', 'amountCents'])
      or (split_value - array['method', 'amountCents', 'cashReceivedCents']) <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(split_value -> 'method') is distinct from 'string'
      or pg_catalog.jsonb_typeof(split_value -> 'amountCents') is distinct from 'number'
      or (split_value ->> 'amountCents') !~ '^[0-9]{1,16}$'
      or (split_value ? 'cashReceivedCents' and (pg_catalog.jsonb_typeof(split_value -> 'cashReceivedCents') is distinct from 'number' or (split_value ->> 'cashReceivedCents') !~ '^[0-9]{1,16}$')) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    split_key := split_value ->> 'method';
    split_amount := (split_value ->> 'amountCents')::numeric;
    if split_amount <= 0 or split_amount > 9007199254740991 or split_key = any(seen_methods) then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    if split_key like 'custom:%' then
      begin split_custom_id := pg_catalog.substring(split_key, 8)::uuid;
      exception when others then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end;
      select custom_method.kind into split_kind from public.restaurant_custom_payment_methods as custom_method
      where custom_method.id = split_custom_id and custom_method.restaurant_id = p_restaurant_id;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_method_disabled'); end if;
    elsif split_key in ('cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher', 'partnership') then
      split_custom_id := null;
      split_kind := case when split_key = 'cash' then 'cash' else 'electronic' end;
    else
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
    end if;
    split_received := case when split_value ? 'cashReceivedCents' then (split_value ->> 'cashReceivedCents')::numeric else split_amount end;
    if split_kind = 'cash' then
      if split_received < split_amount or split_received > 9007199254740991 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
    else
      if split_value ? 'cashReceivedCents' then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
      split_received := null;
    end if;
    seen_methods := pg_catalog.array_append(seen_methods, split_key);
    requested_amount := requested_amount + split_amount;
    request_splits := request_splits || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'method', split_key, 'amountCents', split_amount,
      'cashReceivedCents', split_received
    ));
  end loop;
  select coalesce(pg_catalog.jsonb_agg(item.value order by item.value ->> 'method'), '[]'::jsonb)
  into request_splits from pg_catalog.jsonb_array_elements(request_splits) as item(value);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_restaurant_id::text || ':' || p_request_id::text, 0));
  select existing_payment.* into payment_row
  from public.comanda_payments as existing_payment
  where existing_payment.restaurant_id = p_restaurant_id and existing_payment.request_id = p_request_id
  for update;
  if found then
    if payment_row.created_by <> actor_id or payment_row.comanda_id <> p_comanda_id or payment_row.close_if_paid <> p_close_if_paid then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict');
    end if;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'method', case when split_row.method = 'custom' then 'custom:' || split_row.custom_method_id::text else split_row.method end,
      'amountCents', split_row.amount_cents,
      'cashReceivedCents', split_row.cash_received_cents
    ) order by case when split_row.method = 'custom' then 'custom:' || split_row.custom_method_id::text else split_row.method end), '[]'::jsonb)
    into stored_splits from public.comanda_payment_splits as split_row
    where split_row.payment_id = payment_row.id and split_row.restaurant_id = p_restaurant_id;
    if stored_splits is distinct from request_splits then return pg_catalog.jsonb_build_object('ok', false, 'code', 'request_conflict'); end if;

    select command_row.* into comanda_row from public.comandas as command_row
    where command_row.id = p_comanda_id and command_row.restaurant_id = p_restaurant_id;
    if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found'); end if;
    select coalesce(pg_catalog.sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
    into order_total
    from public.order_items as item
    left join lateral (select pg_catalog.sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
      from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
    join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
    where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
    select coalesce(pg_catalog.sum(existing_payment.amount_cents), 0) into paid_total
    from public.comanda_payments as existing_payment where existing_payment.comanda_id = p_comanda_id and existing_payment.restaurant_id = p_restaurant_id;
    return pg_catalog.jsonb_build_object('ok', true, 'paymentId', payment_row.id, 'closed', comanda_row.status = 'closed',
      'paidCents', paid_total, 'balanceCents', greatest(0, order_total - paid_total));
  end if;

  select restaurant.enabled_payment_methods into enabled_methods
  from public.restaurants as restaurant where restaurant.id = p_restaurant_id and restaurant.status = 'active' for share;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select session_row.* into session_row from public.cash_sessions as session_row
  where session_row.restaurant_id = p_restaurant_id and session_row.status = 'open' for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'cash_session_required'); end if;

  for split_value in select pg_catalog.jsonb_array_elements(p_splits)
  loop
    split_key := split_value ->> 'method';
    split_amount := (split_value ->> 'amountCents')::numeric;
    split_received := case when split_value ? 'cashReceivedCents' then (split_value ->> 'cashReceivedCents')::numeric else split_amount end;
    if split_key like 'custom:%' then
      begin split_custom_id := pg_catalog.substring(split_key, 8)::uuid;
      exception when others then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end;
      select custom_method.label, custom_method.kind into split_label, split_kind
      from public.restaurant_custom_payment_methods as custom_method
      where custom_method.id = split_custom_id and custom_method.restaurant_id = p_restaurant_id and custom_method.is_active;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_method_disabled'); end if;
      split_method := 'custom';
    else
      if split_key not in ('cash', 'debit', 'credit', 'pix', 'meal_voucher', 'food_voucher', 'partnership')
        or not (split_key = any(enabled_methods)) then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_method_disabled');
      end if;
      split_custom_id := null;
      split_method := split_key;
      split_label := case split_key when 'cash' then 'Dinheiro' when 'debit' then 'Débito' when 'credit' then 'Crédito'
        when 'pix' then 'PIX' when 'meal_voucher' then 'VA' when 'food_voucher' then 'VR' when 'partnership' then 'Parceria' end;
      split_kind := case when split_key = 'cash' then 'cash' else 'electronic' end;
    end if;
    if split_kind = 'cash' then
      if split_received < split_amount or split_received > 9007199254740991 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
      split_change := split_received - split_amount;
    else
      if split_value ? 'cashReceivedCents' then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
      split_received := null; split_change := null;
    end if;
  end loop;
  if requested_amount > 9007199254740991 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;

  select command_row.* into comanda_row from public.comandas as command_row
  where command_row.id = p_comanda_id and command_row.restaurant_id = p_restaurant_id for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found'); end if;
  if comanda_row.status not in ('open', 'pending') then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_conflict'); end if;

  select coalesce(pg_catalog.sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
  into order_total
  from public.order_items as item
  left join lateral (select pg_catalog.sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
    from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
  join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
  where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
  select coalesce(pg_catalog.sum(existing_payment.amount_cents), 0) into paid_total
  from public.comanda_payments as existing_payment where existing_payment.comanda_id = p_comanda_id and existing_payment.restaurant_id = p_restaurant_id;
  balance_cents := order_total - paid_total;
  if balance_cents <= 0 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'balance_already_paid'); end if;
  if requested_amount > balance_cents then return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_exceeds_balance'); end if;
  if p_close_if_paid and requested_amount <> balance_cents then return pg_catalog.jsonb_build_object('ok', false, 'code', 'close_requires_full_payment'); end if;

  actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
  insert into public.comanda_payments (restaurant_id, comanda_id, request_id, amount_cents, close_if_paid, cash_session_id, created_by, created_by_name)
  values (p_restaurant_id, p_comanda_id, p_request_id, requested_amount::bigint, p_close_if_paid, session_row.id, actor_id, actor_name)
  returning id into payment_id_value;

  for split_value in select pg_catalog.jsonb_array_elements(p_splits)
  loop
    split_key := split_value ->> 'method';
    split_amount := (split_value ->> 'amountCents')::numeric;
    split_received := case when split_value ? 'cashReceivedCents' then (split_value ->> 'cashReceivedCents')::numeric else split_amount end;
    split_custom_id := null;
    if split_key like 'custom:%' then
      split_custom_id := pg_catalog.substring(split_key, 8)::uuid;
      select custom_method.label, custom_method.kind into split_label, split_kind
      from public.restaurant_custom_payment_methods as custom_method where custom_method.id = split_custom_id and custom_method.restaurant_id = p_restaurant_id;
      split_method := 'custom';
    else
      split_method := split_key;
      split_label := case split_key when 'cash' then 'Dinheiro' when 'debit' then 'Débito' when 'credit' then 'Crédito'
        when 'pix' then 'PIX' when 'meal_voucher' then 'VA' when 'food_voucher' then 'VR' when 'partnership' then 'Parceria' end;
      split_kind := case when split_key = 'cash' then 'cash' else 'electronic' end;
    end if;
    insert into public.comanda_payment_splits (
      restaurant_id, payment_id, method, custom_method_id, method_label_snapshot, method_kind_snapshot,
      amount_cents, cash_received_cents, change_cents, position
    ) values (
      p_restaurant_id, payment_id_value, split_method, split_custom_id, split_label, split_kind,
      split_amount::bigint, case when split_kind = 'cash' then split_received::bigint else null end,
      case when split_kind = 'cash' then (split_received - split_amount)::bigint else null end, split_position
    );
    split_position := split_position + 1;
  end loop;

  if p_close_if_paid then
    update public.comandas set status = 'closed', closed_at = pg_catalog.clock_timestamp(), closed_by = actor_id
    where id = p_comanda_id and restaurant_id = p_restaurant_id and status in ('open', 'pending');
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'paymentId', payment_id_value,
    'closed', p_close_if_paid, 'paidCents', paid_total + requested_amount, 'balanceCents', balance_cents - requested_amount);
end;
$function$;

create function public.close_paid_panel_comanda_v2(p_restaurant_id uuid, p_comanda_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  command_row public.comandas%rowtype;
  order_total numeric := 0;
  paid_total numeric := 0;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_comanda_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select * into command_row from public.comandas where id = p_comanda_id and restaurant_id = p_restaurant_id for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found'); end if;
  if command_row.status = 'closed' then return pg_catalog.jsonb_build_object('ok', true, 'closed', true, 'alreadyClosed', true); end if;
  select coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
  into order_total from public.order_items as item
  left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
    from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
  join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
  where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
  select coalesce(sum(payment_row.amount_cents), 0) into paid_total from public.comanda_payments as payment_row
  where payment_row.comanda_id = p_comanda_id and payment_row.restaurant_id = p_restaurant_id;
  if order_total <> paid_total then return pg_catalog.jsonb_build_object('ok', false, 'code', 'balance_remaining', 'balanceCents', greatest(0, order_total - paid_total)); end if;
  update public.comandas set status = 'closed', closed_at = pg_catalog.clock_timestamp(), closed_by = actor_id
  where id = p_comanda_id and restaurant_id = p_restaurant_id and status in ('open', 'pending');
  return pg_catalog.jsonb_build_object('ok', true, 'closed', true, 'alreadyClosed', false);
end;
$function$;

create function public.panel_lock_comanda_cash_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.restaurant_id::text || ':cash-close', 0));
  return new;
end;
$function$;

create trigger comandas_serialize_cash_session_close
  before insert on public.comandas
  for each row execute function public.panel_lock_comanda_cash_close();

create trigger financial_movements_broadcast
  after insert on public.financial_movements
  for each row execute function public.panel_orders_broadcast();
create trigger cash_sessions_broadcast
  after insert or update on public.cash_sessions
  for each row execute function public.panel_orders_broadcast();
create trigger custom_payment_methods_broadcast
  after insert or update on public.restaurant_custom_payment_methods
  for each row execute function public.panel_orders_broadcast();

revoke all on function public.update_panel_payment_methods(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.panel_finance_actor_name(uuid) from public, anon, authenticated;
revoke all on function public.update_panel_financial_settings(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.open_panel_cash_session(uuid, uuid, bigint, jsonb) from public, anon;
revoke all on function public.record_panel_financial_movement(uuid, uuid, uuid, text, bigint, text, text, text) from public, anon;
revoke all on function public.close_panel_cash_session(uuid, uuid, uuid, bigint, jsonb, text, boolean) from public, anon;
revoke all on function public.get_panel_cash_session(uuid) from public, anon;
revoke all on function public.get_panel_finance_dashboard(uuid, date, date) from public, anon;
revoke all on function public.record_panel_comanda_payment(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.close_paid_panel_comanda(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_panel_comanda_payment_v2(uuid, uuid, uuid, jsonb, boolean) from public, anon;
revoke all on function public.close_paid_panel_comanda_v2(uuid, uuid) from public, anon;
grant execute on function public.update_panel_financial_settings(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.open_panel_cash_session(uuid, uuid, bigint, jsonb) to authenticated;
grant execute on function public.record_panel_financial_movement(uuid, uuid, uuid, text, bigint, text, text, text) to authenticated;
grant execute on function public.close_panel_cash_session(uuid, uuid, uuid, bigint, jsonb, text, boolean) to authenticated;
grant execute on function public.get_panel_cash_session(uuid) to authenticated;
grant execute on function public.get_panel_finance_dashboard(uuid, date, date) to authenticated;
grant execute on function public.record_panel_comanda_payment_v2(uuid, uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.close_paid_panel_comanda_v2(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
