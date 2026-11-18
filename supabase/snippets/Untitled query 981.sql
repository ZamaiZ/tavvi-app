alter table public.restaurants
  add column tip_mode text not null default 'disabled',
  add column tip_percentage_bps integer,
  add column tip_fixed_cents bigint,
  add constraint restaurants_tip_policy_check check (
    (tip_mode = 'disabled' and tip_percentage_bps is null and tip_fixed_cents is null)
    or (tip_mode = 'percentage' and tip_percentage_bps is not null and tip_percentage_bps between 1 and 10000 and tip_fixed_cents is null)
    or (tip_mode = 'fixed' and tip_percentage_bps is null and tip_fixed_cents is not null and tip_fixed_cents between 1 and 9007199254740991)
  );

alter table public.comandas
  add column consumption_closed_at timestamptz,
  add column consumption_closed_by uuid references auth.users (id) on delete restrict,
  add column consumption_close_request_id uuid,
  add constraint comandas_consumption_closure_fields_check check (
    (consumption_closed_at is null and consumption_closed_by is null and consumption_close_request_id is null)
    or (consumption_closed_at is not null and consumption_closed_by is not null and consumption_close_request_id is not null)
  );

create index comandas_consumption_close_request_idx
  on public.comandas (restaurant_id, consumption_close_request_id)
  where consumption_close_request_id is not null;

create table public.comanda_tip_decisions (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  comanda_id uuid not null,
  request_id uuid not null,
  decision text not null check (decision in ('accepted', 'declined', 'disabled')),
  rule_mode text not null check (rule_mode in ('percentage', 'fixed', 'disabled')),
  percentage_bps_snapshot integer,
  fixed_cents_snapshot bigint,
  tip_amount_cents bigint not null check (tip_amount_cents between 0 and 9007199254740991),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_by_name text not null check (pg_catalog.char_length(pg_catalog.btrim(created_by_name)) between 1 and 120),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (id, restaurant_id),
  unique (restaurant_id, comanda_id),
  unique (restaurant_id, request_id),
  constraint comanda_tip_decisions_comanda_same_restaurant foreign key (comanda_id, restaurant_id)
    references public.comandas (id, restaurant_id) on delete cascade,
  constraint comanda_tip_decisions_rule_snapshot_check check (
    (rule_mode = 'percentage' and decision in ('accepted', 'declined') and percentage_bps_snapshot is not null and percentage_bps_snapshot between 1 and 10000 and fixed_cents_snapshot is null)
    or (rule_mode = 'fixed' and decision in ('accepted', 'declined') and percentage_bps_snapshot is null and fixed_cents_snapshot is not null and fixed_cents_snapshot between 1 and 9007199254740991)
    or (rule_mode = 'disabled' and decision = 'disabled' and percentage_bps_snapshot is null and fixed_cents_snapshot is null and tip_amount_cents = 0)
  ),
  constraint comanda_tip_decisions_nonaccepted_zero_check check (decision = 'accepted' or tip_amount_cents = 0)
);

alter table public.comanda_tip_decisions enable row level security;
revoke all on public.comanda_tip_decisions from public, anon, authenticated;
grant select on public.comanda_tip_decisions to authenticated;
create policy comanda_tip_decisions_select_member on public.comanda_tip_decisions
  for select to authenticated using (public.panel_menu_member(restaurant_id));

alter table public.comanda_payments
  add column tip_decision_snapshot text,
  add column tip_amount_cents bigint not null default 0,
  add constraint comanda_payments_tip_decision_snapshot_check check (
    tip_decision_snapshot is null or tip_decision_snapshot in ('accepted', 'declined', 'disabled')
  ),
  add constraint comanda_payments_tip_amount_check check (tip_amount_cents between 0 and amount_cents),
  add constraint comanda_payments_tip_acceptance_check check (tip_amount_cents = 0 or tip_decision_snapshot = 'accepted');

create function public.update_panel_financial_settings_v2(
  p_restaurant_id uuid,
  p_enabled_methods jsonb,
  p_custom_methods jsonb,
  p_tip_mode text,
  p_tip_percentage_bps integer,
  p_tip_fixed_cents bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  settings_result jsonb;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_tip_mode is null or p_tip_mode not in ('disabled', 'percentage', 'fixed')
    or (p_tip_mode = 'disabled' and (p_tip_percentage_bps is not null or p_tip_fixed_cents is not null))
    or (p_tip_mode = 'percentage' and (p_tip_percentage_bps is null or p_tip_percentage_bps not between 1 and 10000 or p_tip_fixed_cents is not null))
    or (p_tip_mode = 'fixed' and (p_tip_percentage_bps is not null or p_tip_fixed_cents is null or p_tip_fixed_cents not between 1 and 9007199254740991)) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  perform 1 from public.restaurants where id = p_restaurant_id and status = 'active' for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  settings_result := public.update_panel_financial_settings(p_restaurant_id, p_enabled_methods, p_custom_methods);
  if settings_result ->> 'ok' <> 'true' then return settings_result; end if;

  update public.restaurants set
    tip_mode = p_tip_mode,
    tip_percentage_bps = p_tip_percentage_bps,
    tip_fixed_cents = p_tip_fixed_cents
  where id = p_restaurant_id and status = 'active';
  return settings_result || pg_catalog.jsonb_build_object('tipPolicy', pg_catalog.jsonb_build_object(
    'mode', p_tip_mode, 'percentageBps', p_tip_percentage_bps, 'fixedCents', p_tip_fixed_cents
  ));
end;
$function$;

create function public.close_panel_comanda_consumption(
  p_restaurant_id uuid,
  p_comanda_id uuid,
  p_request_id uuid,
  p_tip_decision text
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
  restaurant_row public.restaurants%rowtype;
  comanda_row public.comandas%rowtype;
  decision_row public.comanda_tip_decisions%rowtype;
  subtotal_cents numeric := 0;
  paid_cents numeric := 0;
  tip_cents numeric := 0;
  due_cents numeric := 0;
  next_status text;
  now_at timestamptz := pg_catalog.clock_timestamp();
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_comanda_id is null or p_request_id is null
    or (p_tip_decision is not null and p_tip_decision not in ('accepted', 'declined')) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select * into restaurant_row from public.restaurants where id = p_restaurant_id and status = 'active' for share;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into comanda_row from public.comandas where id = p_comanda_id and restaurant_id = p_restaurant_id for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found'); end if;
  select * into decision_row from public.comanda_tip_decisions where restaurant_id = p_restaurant_id and comanda_id = p_comanda_id;
  if comanda_row.consumption_closed_at is not null then
    if comanda_row.consumption_close_request_id = p_request_id and comanda_row.consumption_closed_by = actor_id
      and (p_tip_decision is null or decision_row.decision = p_tip_decision) then
      select coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
      into subtotal_cents
      from public.order_items as item
      left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
      join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
      where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
      select coalesce(sum(payment.amount_cents), 0) into paid_cents from public.comanda_payments as payment where payment.comanda_id = p_comanda_id and payment.restaurant_id = p_restaurant_id;
      tip_cents := case when decision_row.decision = 'accepted' then decision_row.tip_amount_cents else 0 end;
      return pg_catalog.jsonb_build_object('ok', true, 'alreadyClosed', true, 'status', comanda_row.status,
        'tipCents', tip_cents, 'totalCents', subtotal_cents + tip_cents, 'balanceCents', greatest(0, subtotal_cents + tip_cents - paid_cents));
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_conflict');
  end if;
  if comanda_row.status <> 'open' then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_conflict'); end if;
  if restaurant_row.tip_mode = 'disabled' and p_tip_decision is not null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
  if restaurant_row.tip_mode <> 'disabled' and p_tip_decision is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'tip_decision_required'); end if;

  select coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
  into subtotal_cents
  from public.order_items as item
  left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
  join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
  where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
  select coalesce(sum(payment.amount_cents), 0) into paid_cents from public.comanda_payments as payment where payment.comanda_id = p_comanda_id and payment.restaurant_id = p_restaurant_id;
  if subtotal_cents > 9007199254740991 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow'); end if;

  if restaurant_row.tip_mode <> 'disabled' then
    tip_cents := case when p_tip_decision = 'declined' then 0
      when restaurant_row.tip_mode = 'percentage' then pg_catalog.round(subtotal_cents * restaurant_row.tip_percentage_bps / 10000)
      else restaurant_row.tip_fixed_cents end;
    if tip_cents > 9007199254740991 or subtotal_cents + tip_cents > 9007199254740991 then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow');
    end if;
    due_cents := subtotal_cents + tip_cents - paid_cents;
    if due_cents < 0 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow'); end if;
    actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
    insert into public.comanda_tip_decisions (
      restaurant_id, comanda_id, request_id, decision, rule_mode, percentage_bps_snapshot, fixed_cents_snapshot,
      tip_amount_cents, created_by, created_by_name, created_at
    ) values (
      p_restaurant_id, p_comanda_id, p_request_id, p_tip_decision, restaurant_row.tip_mode,
      case when restaurant_row.tip_mode = 'percentage' then restaurant_row.tip_percentage_bps else null end,
      case when restaurant_row.tip_mode = 'fixed' then restaurant_row.tip_fixed_cents else null end,
      tip_cents::bigint, actor_id, actor_name, now_at
    );
  else
    due_cents := subtotal_cents - paid_cents;
    if due_cents < 0 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow'); end if;
    actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
    insert into public.comanda_tip_decisions (
      restaurant_id, comanda_id, request_id, decision, rule_mode, percentage_bps_snapshot, fixed_cents_snapshot,
      tip_amount_cents, created_by, created_by_name, created_at
    ) values (p_restaurant_id, p_comanda_id, p_request_id, 'disabled', 'disabled', null, null, 0, actor_id, actor_name, now_at);
  end if;
  next_status := case when due_cents = 0 then 'closed' else 'pending' end;
  update public.comandas set
    status = next_status,
    consumption_closed_at = now_at,
    consumption_closed_by = actor_id,
    consumption_close_request_id = p_request_id,
    closed_at = case when next_status = 'closed' then now_at else null end,
    closed_by = case when next_status = 'closed' then actor_id else null end
  where id = p_comanda_id and restaurant_id = p_restaurant_id and status = 'open';
  return pg_catalog.jsonb_build_object('ok', true, 'alreadyClosed', false, 'status', next_status,
    'tipCents', tip_cents, 'totalCents', subtotal_cents + tip_cents, 'balanceCents', greatest(0, due_cents));
end;
$function$;

create function public.resolve_panel_comanda_tip(
  p_restaurant_id uuid,
  p_comanda_id uuid,
  p_request_id uuid,
  p_tip_decision text
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
  restaurant_row public.restaurants%rowtype;
  comanda_row public.comandas%rowtype;
  existing_decision public.comanda_tip_decisions%rowtype;
  subtotal_cents numeric := 0;
  paid_cents numeric := 0;
  tip_cents numeric := 0;
  balance_cents numeric := 0;
  now_at timestamptz := pg_catalog.clock_timestamp();
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_comanda_id is null or p_request_id is null
    or (p_tip_decision is not null and p_tip_decision not in ('accepted', 'declined')) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  select * into restaurant_row from public.restaurants where id = p_restaurant_id and status = 'active' for share;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into comanda_row from public.comandas where id = p_comanda_id and restaurant_id = p_restaurant_id for update;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_not_found'); end if;
  select * into existing_decision from public.comanda_tip_decisions where restaurant_id = p_restaurant_id and comanda_id = p_comanda_id;
  if found then
    if existing_decision.request_id = p_request_id and existing_decision.created_by = actor_id
      and (existing_decision.decision = p_tip_decision or (existing_decision.decision = 'disabled' and p_tip_decision is null)) then
      select coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
      into subtotal_cents
      from public.order_items as item
      left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
      join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
      where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
      select coalesce(sum(payment.amount_cents), 0) into paid_cents from public.comanda_payments as payment where payment.comanda_id = p_comanda_id and payment.restaurant_id = p_restaurant_id;
      return pg_catalog.jsonb_build_object('ok', true, 'alreadyResolved', true, 'closed', comanda_row.status = 'closed',
        'tipCents', existing_decision.tip_amount_cents, 'totalCents', subtotal_cents + existing_decision.tip_amount_cents,
        'balanceCents', greatest(0, subtotal_cents + existing_decision.tip_amount_cents - paid_cents));
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'tip_already_decided');
  end if;
  if comanda_row.status <> 'pending' then return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_conflict'); end if;
  if restaurant_row.tip_mode = 'disabled' and p_tip_decision is not null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
  if restaurant_row.tip_mode <> 'disabled' and p_tip_decision is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'tip_decision_required'); end if;

  select coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0)
  into subtotal_cents
  from public.order_items as item
  left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
  join public.orders as order_row on order_row.id = item.order_id and order_row.restaurant_id = item.restaurant_id
  where order_row.comanda_id = p_comanda_id and order_row.restaurant_id = p_restaurant_id;
  select coalesce(sum(payment.amount_cents), 0) into paid_cents from public.comanda_payments as payment where payment.comanda_id = p_comanda_id and payment.restaurant_id = p_restaurant_id;
  if subtotal_cents > 9007199254740991 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow'); end if;
  if restaurant_row.tip_mode <> 'disabled' then
    tip_cents := case when p_tip_decision = 'declined' then 0
      when restaurant_row.tip_mode = 'percentage' then pg_catalog.round(subtotal_cents * restaurant_row.tip_percentage_bps / 10000)
      else restaurant_row.tip_fixed_cents end;
    if tip_cents > 9007199254740991 or subtotal_cents + tip_cents > 9007199254740991 then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow');
    end if;
    balance_cents := subtotal_cents + tip_cents - paid_cents;
    if balance_cents < 0 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow'); end if;
    actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
    insert into public.comanda_tip_decisions (
      restaurant_id, comanda_id, request_id, decision, rule_mode, percentage_bps_snapshot, fixed_cents_snapshot,
      tip_amount_cents, created_by, created_by_name, created_at
    ) values (
      p_restaurant_id, p_comanda_id, p_request_id, p_tip_decision, restaurant_row.tip_mode,
      case when restaurant_row.tip_mode = 'percentage' then restaurant_row.tip_percentage_bps else null end,
      case when restaurant_row.tip_mode = 'fixed' then restaurant_row.tip_fixed_cents else null end,
      tip_cents::bigint, actor_id, actor_name, now_at
    );
  else
    balance_cents := subtotal_cents - paid_cents;
    if balance_cents < 0 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow'); end if;
    actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
    insert into public.comanda_tip_decisions (
      restaurant_id, comanda_id, request_id, decision, rule_mode, percentage_bps_snapshot, fixed_cents_snapshot,
      tip_amount_cents, created_by, created_by_name, created_at
    ) values (p_restaurant_id, p_comanda_id, p_request_id, 'disabled', 'disabled', null, null, 0, actor_id, actor_name, now_at);
  end if;
  update public.comandas set
    consumption_closed_at = coalesce(consumption_closed_at, now_at),
    consumption_closed_by = coalesce(consumption_closed_by, actor_id),
    consumption_close_request_id = coalesce(consumption_close_request_id, p_request_id),
    status = case when balance_cents = 0 then 'closed' else status end,
    closed_at = case when balance_cents = 0 then now_at else closed_at end,
    closed_by = case when balance_cents = 0 then actor_id else closed_by end
  where id = p_comanda_id and restaurant_id = p_restaurant_id and status = 'pending';
  return pg_catalog.jsonb_build_object('ok', true, 'alreadyResolved', false, 'closed', balance_cents = 0,
    'tipCents', tip_cents, 'totalCents', subtotal_cents + tip_cents, 'balanceCents', balance_cents);
end;
$function$;


create function public.record_panel_comanda_payment_v3(
  p_restaurant_id uuid,
  p_comanda_id uuid,
  p_request_id uuid,
  p_splits jsonb,
  p_close_if_paid boolean,
  p_tip_decision text
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
  restaurant_row public.restaurants%rowtype;
  decision_row public.comanda_tip_decisions%rowtype;
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
  tip_total numeric := 0;
  tips_paid numeric := 0;
  consumption_paid_before numeric := 0;
  tip_for_payment numeric := 0;
  recorded_tip_decision text;
  decision_exists boolean := false;
  balance_cents numeric := 0;
  should_close boolean := false;
  payment_row public.comanda_payments%rowtype;
  comanda_row public.comandas%rowtype;
  session_row public.cash_sessions%rowtype;
  payment_id_value uuid;
begin
  if actor_id is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_comanda_id is null or p_request_id is null or p_close_if_paid is null
    or (p_tip_decision is not null and p_tip_decision not in ('accepted', 'declined'))
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
    if payment_row.created_by <> actor_id or payment_row.comanda_id <> p_comanda_id or payment_row.close_if_paid <> p_close_if_paid
      or (payment_row.tip_decision_snapshot is distinct from p_tip_decision
        and not (payment_row.tip_decision_snapshot = 'disabled' and p_tip_decision is null)) then
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
    select coalesce((select decision_row.tip_amount_cents from public.comanda_tip_decisions as decision_row
      where decision_row.comanda_id = p_comanda_id and decision_row.restaurant_id = p_restaurant_id), 0) into tip_total;
    return pg_catalog.jsonb_build_object('ok', true, 'paymentId', payment_row.id, 'closed', comanda_row.status = 'closed',
      'paidCents', paid_total, 'tipCents', tip_total, 'balanceCents', greatest(0, order_total + tip_total - paid_total));
  end if;

  select restaurant.* into restaurant_row
  from public.restaurants as restaurant where restaurant.id = p_restaurant_id and restaurant.status = 'active' for share;
  if not found then return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  enabled_methods := restaurant_row.enabled_payment_methods;
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
  select * into decision_row from public.comanda_tip_decisions as tip_decision
  where tip_decision.comanda_id = p_comanda_id and tip_decision.restaurant_id = p_restaurant_id;
  decision_exists := found;
  if comanda_row.status = 'open' then
    if p_close_if_paid or p_tip_decision is not null or decision_exists then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'comanda_conflict');
    end if;
    recorded_tip_decision := null;
  else
    if decision_exists then
      if p_tip_decision is not null and p_tip_decision <> decision_row.decision then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'tip_decision_conflict');
      end if;
      recorded_tip_decision := decision_row.decision;
      tip_total := decision_row.tip_amount_cents;
    else
      if restaurant_row.tip_mode = 'disabled' and p_tip_decision is not null then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
      end if;
      if restaurant_row.tip_mode <> 'disabled' and p_tip_decision is null then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'tip_decision_required');
      end if;
      if restaurant_row.tip_mode = 'disabled' then
        recorded_tip_decision := 'disabled';
      else
        recorded_tip_decision := p_tip_decision;
        tip_total := case when p_tip_decision = 'declined' then 0
          when restaurant_row.tip_mode = 'percentage' then pg_catalog.round(order_total * restaurant_row.tip_percentage_bps / 10000)
          else restaurant_row.tip_fixed_cents end;
      end if;
    end if;
  end if;
  if order_total > 9007199254740991 or tip_total > 9007199254740991 or order_total + tip_total > 9007199254740991 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'amount_overflow');
  end if;
  balance_cents := order_total + tip_total - paid_total;
  if balance_cents <= 0 then return pg_catalog.jsonb_build_object('ok', false, 'code', 'balance_already_paid'); end if;
  if requested_amount > balance_cents then return pg_catalog.jsonb_build_object('ok', false, 'code', 'payment_exceeds_balance'); end if;
  if p_close_if_paid and requested_amount <> balance_cents then return pg_catalog.jsonb_build_object('ok', false, 'code', 'close_requires_full_payment'); end if;
  should_close := p_close_if_paid or (comanda_row.status = 'pending' and requested_amount = balance_cents);

  if comanda_row.status = 'pending' and not decision_exists then
    actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
    insert into public.comanda_tip_decisions (
      restaurant_id, comanda_id, request_id, decision, rule_mode, percentage_bps_snapshot, fixed_cents_snapshot,
      tip_amount_cents, created_by, created_by_name
    ) values (
      p_restaurant_id, p_comanda_id, p_request_id, recorded_tip_decision, restaurant_row.tip_mode,
      case when restaurant_row.tip_mode = 'percentage' then restaurant_row.tip_percentage_bps else null end,
      case when restaurant_row.tip_mode = 'fixed' then restaurant_row.tip_fixed_cents else null end,
      tip_total::bigint, actor_id, coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe')
    );
  end if;
  select coalesce(pg_catalog.sum(existing_payment.tip_amount_cents), 0) into tips_paid
  from public.comanda_payments as existing_payment where existing_payment.comanda_id = p_comanda_id and existing_payment.restaurant_id = p_restaurant_id;
  consumption_paid_before := greatest(0, paid_total - tips_paid);
  tip_for_payment := least(greatest(0, tip_total - tips_paid), greatest(0, requested_amount - greatest(0, order_total - consumption_paid_before)));

  actor_name := coalesce(public.panel_finance_actor_name(actor_id), 'Pessoa da equipe');
  insert into public.comanda_payments (restaurant_id, comanda_id, request_id, amount_cents, close_if_paid, cash_session_id, created_by, created_by_name, tip_decision_snapshot, tip_amount_cents)
  values (p_restaurant_id, p_comanda_id, p_request_id, requested_amount::bigint, p_close_if_paid, session_row.id, actor_id, actor_name, recorded_tip_decision, tip_for_payment::bigint)
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

  if should_close then
    update public.comandas set status = 'closed', closed_at = pg_catalog.clock_timestamp(), closed_by = actor_id,
      consumption_closed_at = coalesce(consumption_closed_at, pg_catalog.clock_timestamp()),
      consumption_closed_by = coalesce(consumption_closed_by, actor_id),
      consumption_close_request_id = coalesce(consumption_close_request_id, p_request_id)
    where id = p_comanda_id and restaurant_id = p_restaurant_id and status in ('open', 'pending');
  elsif comanda_row.status = 'pending' then
    update public.comandas set
      consumption_closed_at = coalesce(consumption_closed_at, pg_catalog.clock_timestamp()),
      consumption_closed_by = coalesce(consumption_closed_by, actor_id),
      consumption_close_request_id = coalesce(consumption_close_request_id, p_request_id)
    where id = p_comanda_id and restaurant_id = p_restaurant_id and status = 'pending';
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'paymentId', payment_id_value,
    'closed', should_close, 'paidCents', paid_total + requested_amount, 'tipCents', tip_total, 'balanceCents', balance_cents - requested_amount);
end;
$function$;

create or replace function public.close_panel_cash_session(
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
  closed_at_value timestamptz := pg_catalog.clock_timestamp();
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
    update public.comandas set
      status = 'pending',
      table_number = null,
      consumption_closed_at = coalesce(consumption_closed_at, closed_at_value),
      consumption_closed_by = coalesce(consumption_closed_by, actor_id),
      consumption_close_request_id = coalesce(consumption_close_request_id, p_request_id)
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
    closed_at = closed_at_value,
    close_request_id = p_request_id
  where id = p_session_id and restaurant_id = p_restaurant_id and status = 'open';

  return pg_catalog.jsonb_build_object('ok', true, 'alreadyClosed', false, 'expectedCents', expected_cents, 'differenceCents', difference_cents, 'pendingComandas', open_comandas_count);
end;
$function$;

create function public.get_panel_comandas_page_summary(p_restaurant_id uuid, p_status text, p_page integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  total_rows bigint;
  page_value integer;
  page_count integer;
  result jsonb;
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'code', 'session_expired'); end if;
  if p_restaurant_id is null or p_status is null or p_status not in ('open', 'closed') or p_page is null or p_page < 1 or p_page > 1000000 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  if not public.panel_menu_member(p_restaurant_id) then return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id and status = 'active') then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select count(*) into total_rows from public.comandas as comanda
    where comanda.restaurant_id = p_restaurant_id
      and (case when p_status = 'closed' then comanda.status = 'closed' else comanda.status in ('open', 'pending') end);
  page_count := greatest(1, pg_catalog.ceil(total_rows::numeric / 25)::integer);
  page_value := case when p_status = 'closed' then least(p_page, page_count) else 1 end;

  with rows as (
    select comanda.id, comanda.restaurant_id, comanda.table_number, comanda.status, comanda.opened_at,
      comanda.closed_at, comanda.closed_by, totals.order_count, totals.item_count, totals.subtotal_cents,
      latest.display_number, latest.customer_name, latest.fulfillment_type, latest.created_at as latest_order_at,
      coalesce(tip.tip_amount_cents, 0) as tip_cents, tip.decision as tip_decision,
      coalesce(payments.paid_cents, 0) as paid_cents
    from public.comandas as comanda
    left join lateral (
      select count(distinct order_row.id)::integer as order_count,
        coalesce(sum(item.quantity), 0)::numeric as item_count,
        coalesce(sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0)), 0) as subtotal_cents
      from public.orders as order_row
      left join public.order_items as item on item.order_id = order_row.id and item.restaurant_id = order_row.restaurant_id
      left join lateral (
        select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents
        from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id
      ) as additions on true
      where order_row.comanda_id = comanda.id and order_row.restaurant_id = comanda.restaurant_id
    ) as totals on true
    left join lateral (
      select order_row.display_number, order_row.customer_name, order_row.fulfillment_type, order_row.created_at
      from public.orders as order_row where order_row.comanda_id = comanda.id and order_row.restaurant_id = comanda.restaurant_id
      order by order_row.created_at desc, order_row.id desc limit 1
    ) as latest on true
    left join lateral (
      select decision.tip_amount_cents, decision.decision from public.comanda_tip_decisions as decision
      where decision.comanda_id = comanda.id and decision.restaurant_id = comanda.restaurant_id
    ) as tip on true
    left join lateral (
      select sum(payment.amount_cents)::numeric as paid_cents from public.comanda_payments as payment
      where payment.comanda_id = comanda.id and payment.restaurant_id = comanda.restaurant_id
    ) as payments on true
    where comanda.restaurant_id = p_restaurant_id
      and (case when p_status = 'closed' then comanda.status = 'closed' else comanda.status in ('open', 'pending') end)
    order by
      case when p_status = 'closed' then null else comanda.table_number end asc nulls last,
      case when p_status = 'closed' then comanda.closed_at else comanda.opened_at end desc,
      comanda.id desc
    limit case when p_status = 'closed' then 25 else null end
    offset case when p_status = 'closed' then (page_value - 1) * 25 else 0 end
  )
  select pg_catalog.jsonb_build_object(
    'ok', true, 'status', p_status, 'page', page_value, 'pageSize', case when p_status = 'closed' then 25 else total_rows end,
    'totalRows', total_rows, 'comandas', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', rows.id, 'restaurantId', rows.restaurant_id, 'tableNumber', rows.table_number, 'status', rows.status,
      'openedAt', rows.opened_at, 'closedAt', rows.closed_at, 'closedBy', rows.closed_by,
      'latestOrder', case when rows.latest_order_at is null then null else pg_catalog.jsonb_build_object(
        'displayNumber', rows.display_number, 'customerName', rows.customer_name,
        'fulfillmentType', rows.fulfillment_type, 'createdAt', rows.latest_order_at) end,
      'orderCount', rows.order_count, 'itemCount', rows.item_count,
      'subtotalCents', rows.subtotal_cents, 'tipCents', rows.tip_cents, 'tipDecision', rows.tip_decision,
      'totalCents', rows.subtotal_cents + rows.tip_cents, 'paidCents', rows.paid_cents,
      'balanceCents', greatest(0, rows.subtotal_cents + rows.tip_cents - rows.paid_cents)
    ) order by case when p_status = 'closed' then rows.closed_at else rows.opened_at end desc, rows.id desc), '[]'::jsonb)
  ) into result from rows;
  return result;
end;
$function$;

create function public.get_panel_finance_overview(p_restaurant_id uuid, p_from date, p_to date)
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
  select restaurant.time_zone into restaurant_zone from public.restaurants as restaurant
    where restaurant.id = p_restaurant_id and restaurant.status = 'active';
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
      from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id
    ) as additions on true
    where order_row.restaurant_id = p_restaurant_id and order_row.created_at >= start_at and order_row.created_at < end_at
    group by order_row.id, order_row.created_at
  ), payment_totals as (
    select payment.id, payment.created_at, payment.amount_cents, payment.tip_amount_cents,
      coalesce(sum(split.amount_cents) filter (where split.method_kind_snapshot = 'cash'), 0) as cash_cents
    from public.comanda_payments as payment
    left join public.comanda_payment_splits as split on split.payment_id = payment.id and split.restaurant_id = payment.restaurant_id
    where payment.restaurant_id = p_restaurant_id and payment.created_at >= start_at and payment.created_at < end_at
    group by payment.id, payment.created_at, payment.amount_cents, payment.tip_amount_cents
  ), daily as (
    select calendar_day::date as day,
      coalesce((select sum(order_total.total_cents) from order_totals as order_total where (order_total.created_at at time zone restaurant_zone)::date = calendar_day::date), 0) as sales_cents,
      coalesce((select sum(payment.amount_cents) from payment_totals as payment where (payment.created_at at time zone restaurant_zone)::date = calendar_day::date), 0) as received_cents
    from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as calendar_day
  ), pending_balances as (
    select comanda.id,
      greatest(0,
        coalesce((select sum(item.quantity::numeric * item.unit_price_cents + item.quantity::numeric * coalesce(additions.total_cents, 0))
          from public.orders as order_row
          join public.order_items as item on item.order_id = order_row.id and item.restaurant_id = order_row.restaurant_id
          left join lateral (select sum(addition.quantity::numeric * addition.unit_price_cents) as total_cents from public.order_item_additions as addition where addition.order_item_id = item.id and addition.restaurant_id = item.restaurant_id) as additions on true
          where order_row.comanda_id = comanda.id and order_row.restaurant_id = p_restaurant_id), 0)
        + coalesce((select decision.tip_amount_cents from public.comanda_tip_decisions as decision where decision.comanda_id = comanda.id and decision.restaurant_id = p_restaurant_id), 0)
        - coalesce((select sum(payment.amount_cents) from public.comanda_payments as payment where payment.comanda_id = comanda.id and payment.restaurant_id = p_restaurant_id), 0)
      ) as balance_cents
    from public.comandas as comanda where comanda.restaurant_id = p_restaurant_id and comanda.status in ('open', 'pending')
  )
  select pg_catalog.jsonb_build_object(
    'ok', true, 'from', p_from, 'to', p_to, 'timeZone', restaurant_zone,
    'salesCents', coalesce((select sum(total_cents) from order_totals), 0),
    'receivedCents', coalesce((select sum(amount_cents) from payment_totals), 0),
    'cashReceivedCents', coalesce((select sum(cash_cents) from payment_totals), 0),
    'tipsReceivedCents', coalesce((select sum(tip_amount_cents) from payment_totals), 0),
    'expensesCents', coalesce((select sum(movement.amount_cents) from public.financial_movements as movement where movement.restaurant_id = p_restaurant_id and movement.kind = 'expense' and movement.created_at >= start_at and movement.created_at < end_at), 0),
    'pendingCents', coalesce((select sum(balance_cents) from pending_balances), 0),
    'daily', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('day', day, 'salesCents', sales_cents, 'receivedCents', received_cents) order by day) from daily), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.update_panel_financial_settings_v2(uuid, jsonb, jsonb, text, integer, bigint) from public, anon;
revoke all on function public.close_panel_comanda_consumption(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.resolve_panel_comanda_tip(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.record_panel_comanda_payment_v3(uuid, uuid, uuid, jsonb, boolean, text) from public, anon;
revoke all on function public.get_panel_comandas_page_summary(uuid, text, integer) from public, anon;
revoke all on function public.get_panel_finance_overview(uuid, date, date) from public, anon;
revoke all on function public.record_panel_comanda_payment_v2(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.close_paid_panel_comanda_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.update_panel_financial_settings_v2(uuid, jsonb, jsonb, text, integer, bigint) to authenticated;
grant execute on function public.close_panel_comanda_consumption(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.resolve_panel_comanda_tip(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.record_panel_comanda_payment_v3(uuid, uuid, uuid, jsonb, boolean, text) to authenticated;
grant execute on function public.get_panel_comandas_page_summary(uuid, text, integer) to authenticated;
grant execute on function public.get_panel_finance_overview(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
