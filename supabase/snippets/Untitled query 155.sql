create table public.service_calls (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  tag_id uuid not null,
  table_number integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  claimed_at timestamptz,
  claimed_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  constraint service_calls_tag_same_restaurant
    foreign key (tag_id, restaurant_id) references public.menu_tags (id, restaurant_id) on delete cascade,
  constraint service_calls_table_number_check check (table_number > 0),
  constraint service_calls_status_check check (status in ('pending', 'in_progress', 'resolved')),
  constraint service_calls_state_check check (
    (status = 'pending' and claimed_at is null and resolved_at is null and resolved_by is null)
    or (status = 'in_progress' and claimed_at is not null and resolved_at is null and resolved_by is null)
    or (status = 'resolved' and claimed_at is not null and resolved_at is not null)
  )
);

create unique index service_calls_one_active_per_table_key
  on public.service_calls (restaurant_id, table_number)
  where status in ('pending', 'in_progress');

create index service_calls_restaurant_status_created_idx
  on public.service_calls (restaurant_id, status, created_at);

create index service_calls_tag_created_idx
  on public.service_calls (tag_id, created_at desc, id desc);

alter table public.service_calls enable row level security;
revoke all on public.service_calls from public, anon, authenticated;
grant select on public.service_calls to authenticated;

drop policy if exists service_calls_select_member on public.service_calls;
create policy service_calls_select_member on public.service_calls
  for select to authenticated
  using (public.panel_menu_member(restaurant_id));

drop function if exists public.resolve_menu_tag_token(text);

create function public.resolve_menu_tag_token(p_token text)
returns table (restaurant_slug text, table_number integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select restaurant.slug, tag.table_number
  from public.menu_tags as tag
  join public.restaurants as restaurant on restaurant.id = tag.restaurant_id
  where p_token ~ '^[0-9A-F]{32}$'
    and tag.public_token = p_token
    and tag.is_active
    and restaurant.status = 'active';
$function$;

create or replace function public.update_menu_tag_table_number(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_table_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tag public.menu_tags%rowtype;
  v_constraint text;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_tag_id is null or p_table_number is null or p_table_number <= 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_tag
  from public.menu_tags
  where id = p_tag_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_tag.table_number is distinct from p_table_number and exists (
    select 1 from public.service_calls as call_row
    where call_row.tag_id = p_tag_id
      and call_row.restaurant_id = p_restaurant_id
      and call_row.status in ('pending', 'in_progress')
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'active_call');
  end if;

  begin
    update public.menu_tags
    set table_number = p_table_number,
        updated_at = pg_catalog.statement_timestamp()
    where id = p_tag_id and restaurant_id = p_restaurant_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'menu_tags_active_table_key' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'table_conflict');
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'database_error');
  end;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.get_public_service_call_status(p_token text)
returns table (call_id uuid, table_number integer, status text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tag public.menu_tags%rowtype;
begin
  if p_token is null or pg_catalog.char_length(p_token) <> 32 or p_token !~ '^[0-9A-F]{32}$' then
    raise exception 'service_call_unavailable';
  end if;

  select tag.* into v_tag
  from public.menu_tags as tag
  join public.restaurants as restaurant on restaurant.id = tag.restaurant_id
  where tag.public_token = p_token
    and tag.is_active
    and restaurant.status = 'active'
    and restaurant.menu_status = 'published';
  if not found then
    raise exception 'service_call_unavailable';
  end if;

  return query
  select call_row.id, call_row.table_number, call_row.status
  from public.service_calls as call_row
  where call_row.restaurant_id = v_tag.restaurant_id
    and call_row.table_number = v_tag.table_number
  order by call_row.created_at desc, call_row.id desc
  limit 1;
end;
$function$;

create or replace function public.set_menu_tag_active(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tag public.menu_tags%rowtype;
  v_constraint text;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_tag_id is null or p_is_active is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_tag
  from public.menu_tags
  where id = p_tag_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_tag.is_active and not p_is_active and exists (
    select 1 from public.service_calls as call_row
    where call_row.tag_id = p_tag_id
      and call_row.restaurant_id = p_restaurant_id
      and call_row.status in ('pending', 'in_progress')
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'active_call');
  end if;

  begin
    update public.menu_tags
    set is_active = p_is_active,
        updated_at = pg_catalog.statement_timestamp()
    where id = p_tag_id and restaurant_id = p_restaurant_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'menu_tags_active_table_key' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'table_conflict');
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'database_error');
  end;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.request_service_call(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_tag public.menu_tags%rowtype;
  v_call public.service_calls%rowtype;
  v_recent_count integer;
begin
  if p_token is null or pg_catalog.char_length(p_token) <> 32 or p_token !~ '^[0-9A-F]{32}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  select tag.* into v_tag
  from public.menu_tags as tag
  join public.restaurants as restaurant on restaurant.id = tag.restaurant_id
  where tag.public_token = p_token
    and tag.is_active
    and restaurant.status = 'active'
    and restaurant.menu_status = 'published'
  for update of tag;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;

  select call_row.* into v_call
  from public.service_calls as call_row
  where call_row.restaurant_id = v_tag.restaurant_id
    and call_row.table_number = v_tag.table_number
    and call_row.status in ('pending', 'in_progress');
  if found then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'callId', v_call.id, 'tableNumber', v_call.table_number,
      'status', v_call.status, 'created', false
    );
  end if;

  select pg_catalog.count(*) into v_recent_count
  from public.service_calls as call_row
  where call_row.tag_id = v_tag.id
    and call_row.created_at > pg_catalog.clock_timestamp() - interval '1 hour';
  if v_recent_count >= 10 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'hourly_limit');
  end if;

  insert into public.service_calls (restaurant_id, tag_id, table_number)
  values (v_tag.restaurant_id, v_tag.id, v_tag.table_number)
  on conflict do nothing
  returning * into v_call;

  if not found then
    select call_row.* into v_call
    from public.service_calls as call_row
    where call_row.restaurant_id = v_tag.restaurant_id
      and call_row.table_number = v_tag.table_number
      and call_row.status in ('pending', 'in_progress');
    if not found then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'callId', v_call.id, 'tableNumber', v_call.table_number,
      'status', v_call.status, 'created', false
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'callId', v_call.id, 'tableNumber', v_call.table_number,
    'status', v_call.status, 'created', true
  );
end;
$function$;

create or replace function public.claim_service_call(p_call_id uuid)
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
  if v_call.status <> 'pending' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'claim_conflict');
  end if;

  update public.service_calls as call_row
  set status = 'in_progress',
      claimed_at = pg_catalog.clock_timestamp(),
      claimed_by = auth.uid()
  where call_row.id = p_call_id
  returning call_row.* into v_call;

  return pg_catalog.jsonb_build_object('ok', true, 'call', pg_catalog.to_jsonb(v_call));
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

  update public.service_calls as call_row
  set status = 'resolved',
      resolved_at = pg_catalog.clock_timestamp(),
      resolved_by = auth.uid()
  where call_row.id = p_call_id
  returning call_row.* into v_call;

  return pg_catalog.jsonb_build_object('ok', true, 'call', pg_catalog.to_jsonb(v_call));
end;
$function$;

create or replace function public.service_calls_staff_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  begin
    perform realtime.broadcast_changes(
      'service_calls:' || new.restaurant_id::text,
      tg_op,
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  exception when others then
    raise warning 'service call staff broadcast failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

create trigger service_calls_staff_broadcast
  after insert or update of status on public.service_calls
  for each row execute function public.service_calls_staff_broadcast();

create or replace function public.service_calls_guest_status_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select tag.public_token into v_token
  from public.menu_tags as tag
  where tag.id = new.tag_id
    and tag.restaurant_id = new.restaurant_id
    and tag.is_active;
  if v_token is null then
    return new;
  end if;

  begin
    perform realtime.send(
      pg_catalog.jsonb_build_object('callId', new.id, 'status', new.status),
      'service_call_status',
      'service_calls_guest:' || v_token,
      true
    );
  exception when others then
    raise warning 'service call guest broadcast failed: %', sqlerrm;
  end;
  return new;
end;
$function$;

create trigger service_calls_guest_status_broadcast
  after insert or update of status on public.service_calls
  for each row execute function public.service_calls_guest_status_broadcast();

create or replace function public.can_read_service_call_guest_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(exists (
    select 1
    from public.menu_tags as tag
    join public.restaurants as restaurant on restaurant.id = tag.restaurant_id
    where p_topic ~ '^service_calls_guest:[0-9A-F]{32}$'
      and tag.public_token = pg_catalog.substr(p_topic, 21)
      and tag.is_active
      and restaurant.status = 'active'
      and restaurant.menu_status = 'published'
  ), false);
$function$;

revoke all on function public.resolve_menu_tag_token(text) from public, authenticated;
grant execute on function public.resolve_menu_tag_token(text) to anon, authenticated;

revoke all on function public.update_menu_tag_table_number(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.update_menu_tag_table_number(uuid, uuid, integer) to authenticated;
revoke all on function public.set_menu_tag_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_menu_tag_active(uuid, uuid, boolean) to authenticated;

revoke all on function public.get_public_service_call_status(text) from public, authenticated;
grant execute on function public.get_public_service_call_status(text) to anon, authenticated;
revoke all on function public.request_service_call(text) from public;
grant execute on function public.request_service_call(text) to anon, authenticated;
revoke all on function public.claim_service_call(uuid) from public, anon;
grant execute on function public.claim_service_call(uuid) to authenticated;
revoke all on function public.resolve_service_call(uuid) from public, anon;
grant execute on function public.resolve_service_call(uuid) to authenticated;

revoke all on function public.service_calls_staff_broadcast() from public, anon, authenticated;
revoke all on function public.service_calls_guest_status_broadcast() from public, anon, authenticated;
revoke all on function public.can_read_service_call_guest_topic(text) from public;
grant execute on function public.can_read_service_call_guest_topic(text) to anon, authenticated;

drop policy if exists service_calls_receive_restaurant_topic on realtime.messages;
create policy service_calls_receive_restaurant_topic on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) ~ '^service_calls:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and public.panel_menu_member(pg_catalog.substr((select realtime.topic()), 15)::uuid)
  );

drop policy if exists service_calls_guest_receive_topic on realtime.messages;
create policy service_calls_guest_receive_topic on realtime.messages
  for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_read_service_call_guest_topic((select realtime.topic()))
  );

notify pgrst, 'reload schema';
