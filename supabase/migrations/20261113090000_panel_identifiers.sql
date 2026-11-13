create table public.menu_tags (
  id uuid primary key not null default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  public_token text not null,
  table_number integer not null,
  is_active boolean not null default true,
  nfc_serial text,
  nfc_protected_at timestamptz,
  nfc_protected_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint menu_tags_id_restaurant_key unique (id, restaurant_id),
  constraint menu_tags_public_token_format_check check (public_token ~ '^[0-9A-F]{32}$'),
  constraint menu_tags_table_number_check check (table_number > 0),
  constraint menu_tags_nfc_serial_format_check check (nfc_serial is null or nfc_serial ~ '^[0-9A-F]{14}$'),
  constraint menu_tags_protected_state_check check (
    (nfc_protected_at is null and nfc_protected_by is null)
    or (nfc_protected_at is not null and nfc_protected_by is not null and nfc_serial is not null)
  ),
  constraint menu_tags_public_token_key unique (public_token)
);

create unique index menu_tags_active_table_key
  on public.menu_tags (restaurant_id, table_number)
  where is_active;

create unique index menu_tags_nfc_serial_key
  on public.menu_tags (nfc_serial)
  where nfc_serial is not null;

create index menu_tags_restaurant_table_idx
  on public.menu_tags (restaurant_id, table_number, created_at desc);

create table public.menu_tag_nfc_operations (
  operation_id uuid primary key,
  tag_id uuid not null,
  restaurant_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete restrict,
  serial text not null,
  status text not null default 'ready',
  write_attempt_id uuid,
  write_attempt_origin text,
  failure_reason text,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint menu_tag_nfc_operations_tag_same_restaurant
    foreign key (tag_id, restaurant_id) references public.menu_tags (id, restaurant_id) on delete cascade,
  constraint menu_tag_nfc_operations_serial_format_check check (serial ~ '^[0-9A-F]{14}$'),
  constraint menu_tag_nfc_operations_status_check check (status in ('ready', 'authorizing', 'writing', 'uncertain', 'failed', 'protected')),
  constraint menu_tag_nfc_operations_write_attempt_origin_check check (write_attempt_origin is null or write_attempt_origin in ('initial', 'recovery')),
  constraint menu_tag_nfc_operations_failure_reason_check check (failure_reason is null or pg_catalog.char_length(failure_reason) <= 80)
);

create index menu_tag_nfc_operations_tag_created_idx
  on public.menu_tag_nfc_operations (restaurant_id, tag_id, created_at desc);

create unique index menu_tag_nfc_operations_active_tag_key
  on public.menu_tag_nfc_operations (restaurant_id, tag_id)
  where status in ('ready', 'authorizing', 'writing', 'uncertain');

create or replace function public.guard_menu_tag_identity()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.restaurant_id is distinct from old.restaurant_id or new.public_token is distinct from old.public_token then
    raise exception 'menu_tag_identity_immutable' using errcode = '23514';
  end if;

  if old.nfc_protected_at is not null and (
    new.nfc_serial is distinct from old.nfc_serial
    or new.nfc_protected_at is distinct from old.nfc_protected_at
    or new.nfc_protected_by is distinct from old.nfc_protected_by
  ) then
    raise exception 'menu_tag_protection_immutable' using errcode = '23514';
  end if;

  return new;
end;
$function$;

create trigger menu_tags_identity_immutable
before update on public.menu_tags
for each row execute function public.guard_menu_tag_identity();

create or replace function public.create_menu_tag(p_restaurant_id uuid, p_table_number integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tag_id uuid;
  v_public_token text;
  v_constraint text;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_table_number is null or p_table_number <= 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  loop
    v_public_token := pg_catalog.upper(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''));
    begin
      insert into public.menu_tags (restaurant_id, public_token, table_number)
      values (p_restaurant_id, v_public_token, p_table_number)
      returning id into v_tag_id;
      return pg_catalog.jsonb_build_object('ok', true, 'id', v_tag_id, 'public_token', v_public_token);
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'menu_tags_active_table_key' then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'table_conflict');
      end if;
      if v_constraint <> 'menu_tags_public_token_key' then
        return pg_catalog.jsonb_build_object('ok', false, 'code', 'database_error');
      end if;
    end;
  end loop;
end;
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
  v_constraint text;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_tag_id is null or p_table_number is null or p_table_number <= 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
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

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return pg_catalog.jsonb_build_object('ok', true);
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
  v_constraint text;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_tag_id is null or p_is_active is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
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

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.begin_menu_tag_nfc_operation(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid,
  p_serial text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tag public.menu_tags%rowtype;
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_tag_id is null or p_operation_id is null or p_serial is null or p_serial !~ '^[0-9A-F]{14}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select * into v_tag
  from public.menu_tags
  where id = p_tag_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not v_tag.is_active then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'inactive');
  end if;
  if v_tag.nfc_protected_at is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'already_protected');
  end if;
  if v_tag.nfc_serial is not null then
    select * into v_operation
    from public.menu_tag_nfc_operations
    where operation_id = p_operation_id
      and tag_id = p_tag_id
      and restaurant_id = p_restaurant_id
      and actor_id = (select auth.uid())
      and serial = p_serial
      and status = 'ready';
    if found and v_tag.nfc_serial = p_serial then
      return pg_catalog.jsonb_build_object('ok', true);
    end if;
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_exists');
  end if;
  if exists (select 1 from public.menu_tags where nfc_serial = p_serial) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'serial_in_use');
  end if;

  begin
    insert into public.menu_tag_nfc_operations (operation_id, tag_id, restaurant_id, actor_id, serial, status)
    values (p_operation_id, p_tag_id, p_restaurant_id, (select auth.uid()), p_serial, 'ready');
    update public.menu_tags
    set nfc_serial = p_serial,
        updated_at = pg_catalog.statement_timestamp()
    where id = p_tag_id and restaurant_id = p_restaurant_id;
  exception when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'serial_in_use');
  end;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.mark_menu_tag_nfc_write_started(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_restaurant_id is null or p_tag_id is null or p_operation_id is null or p_attempt_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  select * into v_operation from public.menu_tag_nfc_operations
  where operation_id = p_operation_id and tag_id = p_tag_id and restaurant_id = p_restaurant_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_not_found');
  end if;
  if v_operation.status = 'writing' then
    if v_operation.updated_at > pg_catalog.statement_timestamp() - interval '90 seconds' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
    end if;
    update public.menu_tag_nfc_operations
    set status = 'uncertain', failure_reason = 'stale_write_interrupted',
        updated_at = pg_catalog.statement_timestamp()
    where operation_id = p_operation_id;
    v_operation.status := 'uncertain';
  end if;
  if v_operation.status = 'authorizing' then
    if v_operation.write_attempt_id = p_attempt_id then
      return pg_catalog.jsonb_build_object('ok', true);
    end if;
    if v_operation.updated_at > pg_catalog.statement_timestamp() - interval '45 seconds' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
    end if;
    if v_operation.write_attempt_origin = 'initial' then
      update public.menu_tag_nfc_operations
      set status = 'ready', write_attempt_id = null, write_attempt_origin = null,
          updated_at = pg_catalog.statement_timestamp()
      where operation_id = p_operation_id;
      v_operation.status := 'ready';
    else
      update public.menu_tag_nfc_operations
      set status = 'uncertain', write_attempt_id = null, write_attempt_origin = null,
          updated_at = pg_catalog.statement_timestamp()
      where operation_id = p_operation_id;
      v_operation.status := 'uncertain';
    end if;
  end if;
  if v_operation.status not in ('ready', 'uncertain') then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  update public.menu_tag_nfc_operations
  set status = 'authorizing', write_attempt_id = p_attempt_id,
      write_attempt_origin = case when v_operation.status = 'uncertain' then 'recovery' else 'initial' end,
      updated_at = pg_catalog.statement_timestamp()
  where operation_id = p_operation_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.mark_menu_tag_nfc_physical_started(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_restaurant_id is null or p_tag_id is null or p_operation_id is null or p_attempt_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  select * into v_operation from public.menu_tag_nfc_operations
  where operation_id = p_operation_id and tag_id = p_tag_id and restaurant_id = p_restaurant_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_not_found');
  end if;
  if v_operation.status = 'writing' and v_operation.write_attempt_id = p_attempt_id then
    return pg_catalog.jsonb_build_object('ok', true);
  end if;
  if v_operation.status <> 'authorizing' or v_operation.write_attempt_id <> p_attempt_id then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  update public.menu_tag_nfc_operations
  set status = 'writing', failure_reason = null, updated_at = pg_catalog.statement_timestamp()
  where operation_id = p_operation_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.cancel_menu_tag_nfc_operation(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  select * into v_operation from public.menu_tag_nfc_operations
  where operation_id = p_operation_id and tag_id = p_tag_id and restaurant_id = p_restaurant_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_not_found');
  end if;
  if v_operation.status = 'failed' and v_operation.failure_reason = 'cancelled' then
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'released');
  end if;
  if v_operation.status = 'failed' and v_operation.failure_reason = 'cancelled_before_write' then
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'released');
  end if;
  if v_operation.status = 'uncertain' then
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'retained');
  end if;
  if v_operation.status = 'writing' then
    if v_operation.updated_at > pg_catalog.statement_timestamp() - interval '90 seconds' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
    end if;
    update public.menu_tag_nfc_operations
    set status = 'uncertain', failure_reason = 'stale_write_interrupted', updated_at = pg_catalog.statement_timestamp()
    where operation_id = p_operation_id;
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'retained');
  end if;
  if v_operation.status = 'authorizing' then
    if v_operation.updated_at > pg_catalog.statement_timestamp() - interval '45 seconds' then
      return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
    end if;
    if v_operation.write_attempt_origin = 'recovery' then
      update public.menu_tag_nfc_operations
      set status = 'uncertain', failure_reason = 'recovery_cancelled_before_lock',
          updated_at = pg_catalog.statement_timestamp()
      where operation_id = p_operation_id;
      return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'retained');
    end if;
    update public.menu_tag_nfc_operations
    set status = 'failed', failure_reason = 'cancelled_before_write', updated_at = pg_catalog.statement_timestamp()
    where operation_id = p_operation_id;
    update public.menu_tags
    set nfc_serial = null, updated_at = pg_catalog.statement_timestamp()
    where id = p_tag_id and restaurant_id = p_restaurant_id
      and nfc_serial = v_operation.serial and nfc_protected_at is null;
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'released');
  end if;
  if v_operation.status <> 'ready' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;

  update public.menu_tag_nfc_operations
  set status = 'failed', failure_reason = 'cancelled', updated_at = pg_catalog.statement_timestamp()
  where operation_id = p_operation_id;
  update public.menu_tags
  set nfc_serial = null, updated_at = pg_catalog.statement_timestamp()
  where id = p_tag_id and restaurant_id = p_restaurant_id
    and nfc_serial = v_operation.serial and nfc_protected_at is null;
  return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'released');
end;
$function$;

create or replace function public.cancel_menu_tag_nfc_write_claim(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_restaurant_id is null or p_tag_id is null or p_operation_id is null or p_attempt_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  select * into v_operation from public.menu_tag_nfc_operations
  where operation_id = p_operation_id and tag_id = p_tag_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_not_found');
  end if;
  if v_operation.write_attempt_id <> p_attempt_id then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  if v_operation.status = 'failed' and v_operation.failure_reason = 'cancelled_before_write' then
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'released');
  end if;
  if v_operation.status = 'uncertain' and v_operation.failure_reason = 'recovery_cancelled_before_lock' then
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'retained');
  end if;
  if v_operation.status <> 'authorizing' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;

  if v_operation.write_attempt_origin = 'recovery' then
    update public.menu_tag_nfc_operations
    set status = 'uncertain', failure_reason = 'recovery_cancelled_before_lock',
        updated_at = pg_catalog.statement_timestamp()
    where operation_id = p_operation_id;
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'retained');
  else
    update public.menu_tag_nfc_operations
    set status = 'failed', failure_reason = 'cancelled_before_write',
        updated_at = pg_catalog.statement_timestamp()
    where operation_id = p_operation_id;
    update public.menu_tags
    set nfc_serial = null, updated_at = pg_catalog.statement_timestamp()
    where id = p_tag_id and restaurant_id = p_restaurant_id
      and nfc_serial = v_operation.serial and nfc_protected_at is null;
    return pg_catalog.jsonb_build_object('ok', true, 'serial_reservation', 'released');
  end if;
end;
$function$;

create or replace function public.mark_menu_tag_nfc_uncertain(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid,
  p_attempt_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_attempt_id is null or p_reason is null or p_reason !~ '^[a-z_]{1,40}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  select * into v_operation from public.menu_tag_nfc_operations
  where operation_id = p_operation_id and tag_id = p_tag_id and restaurant_id = p_restaurant_id for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_not_found');
  end if;
  if v_operation.write_attempt_id <> p_attempt_id then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  if v_operation.status = 'uncertain' then
    return pg_catalog.jsonb_build_object('ok', true);
  end if;
  if v_operation.status not in ('writing') then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  update public.menu_tag_nfc_operations
  set status = 'uncertain', failure_reason = p_reason, updated_at = pg_catalog.statement_timestamp()
  where operation_id = p_operation_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.complete_menu_tag_nfc_protection(
  p_restaurant_id uuid,
  p_tag_id uuid,
  p_operation_id uuid,
  p_serial text,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.menu_tag_nfc_operations%rowtype;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_serial is null or p_serial !~ '^[0-9A-F]{14}$' or p_attempt_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;
  select * into v_operation from public.menu_tag_nfc_operations
  where operation_id = p_operation_id and tag_id = p_tag_id and restaurant_id = p_restaurant_id for update;
  if not found or v_operation.serial <> p_serial then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_not_found');
  end if;
  if v_operation.write_attempt_id <> p_attempt_id then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  if v_operation.status = 'protected' then
    return pg_catalog.jsonb_build_object('ok', true);
  end if;
  if v_operation.status not in ('writing', 'uncertain') then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'operation_state');
  end if;
  update public.menu_tags
  set nfc_serial = p_serial,
      nfc_protected_at = pg_catalog.statement_timestamp(),
      nfc_protected_by = (select auth.uid()),
      updated_at = pg_catalog.statement_timestamp()
  where id = p_tag_id and restaurant_id = p_restaurant_id and nfc_serial = p_serial
    and nfc_protected_at is null;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'serial_mismatch');
  end if;
  update public.menu_tag_nfc_operations
  set status = 'protected', failure_reason = null, updated_at = pg_catalog.statement_timestamp()
  where operation_id = p_operation_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.resolve_menu_tag_token(p_token text)
returns table (restaurant_slug text)
language sql
stable
security definer
set search_path = ''
as $function$
  select restaurant.slug
  from public.menu_tags as tag
  join public.restaurants as restaurant on restaurant.id = tag.restaurant_id
  where p_token ~ '^[0-9A-F]{32}$'
    and tag.public_token = p_token
    and tag.is_active
    and restaurant.status = 'active';
$function$;

alter table public.menu_tags enable row level security;
alter table public.menu_tag_nfc_operations enable row level security;

create policy menu_tags_select_member on public.menu_tags
for select to authenticated using (public.panel_menu_member(restaurant_id));

create policy menu_tag_nfc_operations_select_member on public.menu_tag_nfc_operations
for select to authenticated using (public.panel_menu_member(restaurant_id));

revoke all on public.menu_tags, public.menu_tag_nfc_operations from anon, authenticated;
grant select on public.menu_tags to authenticated;
grant select (operation_id, tag_id, restaurant_id, status, serial) on public.menu_tag_nfc_operations to authenticated;

revoke all on function public.guard_menu_tag_identity() from public, anon, authenticated;
revoke all on function public.create_menu_tag(uuid, integer) from public, anon, authenticated;
revoke all on function public.update_menu_tag_table_number(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.set_menu_tag_active(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.begin_menu_tag_nfc_operation(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_menu_tag_nfc_write_started(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.mark_menu_tag_nfc_physical_started(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_menu_tag_nfc_operation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_menu_tag_nfc_write_claim(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.mark_menu_tag_nfc_uncertain(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_menu_tag_nfc_protection(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.resolve_menu_tag_token(text) from public, authenticated;

grant execute on function public.create_menu_tag(uuid, integer) to authenticated;
grant execute on function public.update_menu_tag_table_number(uuid, uuid, integer) to authenticated;
grant execute on function public.set_menu_tag_active(uuid, uuid, boolean) to authenticated;
grant execute on function public.begin_menu_tag_nfc_operation(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.mark_menu_tag_nfc_write_started(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.mark_menu_tag_nfc_physical_started(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_menu_tag_nfc_operation(uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_menu_tag_nfc_write_claim(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.mark_menu_tag_nfc_uncertain(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.complete_menu_tag_nfc_protection(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.resolve_menu_tag_token(text) to anon, authenticated;
