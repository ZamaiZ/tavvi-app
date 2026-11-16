with linked_orders as (
  select
    order_row.service_call_id,
    order_row.restaurant_id,
    max(order_row.created_at) as last_order_at
  from public.orders as order_row
  join public.service_calls as linked_call
    on linked_call.id = order_row.service_call_id
    and linked_call.restaurant_id = order_row.restaurant_id
  join public.comandas as linked_comanda
    on linked_comanda.id = order_row.comanda_id
    and linked_comanda.restaurant_id = order_row.restaurant_id
    and linked_comanda.table_number = linked_call.table_number
  where order_row.service_call_id is not null
  group by order_row.service_call_id, order_row.restaurant_id
)
update public.service_calls as call_row
set status = 'resolved',
    resolved_at = greatest(call_row.claimed_at, linked_orders.last_order_at),
    resolved_by = call_row.claimed_by
from linked_orders
where call_row.id = linked_orders.service_call_id
  and call_row.restaurant_id = linked_orders.restaurant_id
  and call_row.status = 'in_progress';

create or replace function public.resolve_service_call_for_panel_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.service_call_id is null then
    return new;
  end if;

  update public.service_calls as call_row
  set status = 'resolved',
      resolved_at = pg_catalog.clock_timestamp(),
      resolved_by = new.created_by
  where call_row.id = new.service_call_id
    and call_row.restaurant_id = new.restaurant_id
    and call_row.status = 'in_progress'
    and call_row.claimed_by = new.created_by
    and exists (
      select 1
      from public.comandas as comanda
      where comanda.id = new.comanda_id
        and comanda.restaurant_id = new.restaurant_id
        and comanda.table_number = call_row.table_number
    );

  if not found then
    raise exception using errcode = 'P0001', message = 'call_conflict';
  end if;

  return new;
end;
$function$;

revoke all on function public.resolve_service_call_for_panel_order() from public, anon, authenticated;

create trigger orders_resolve_linked_service_call
  after insert on public.orders
  for each row
  when (new.service_call_id is not null)
  execute function public.resolve_service_call_for_panel_order();

notify pgrst, 'reload schema';
