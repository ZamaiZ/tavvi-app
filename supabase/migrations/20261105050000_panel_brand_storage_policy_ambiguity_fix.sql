-- Evita colisão entre a variável local e memberships.restaurant_id dentro
-- da consulta executada pela policy de escrita do Storage.
create or replace function public.panel_brand_storage_can_write(
  p_object_name text,
  p_allow_active boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  v_restaurant_id uuid;
begin
  if actor_id is null or p_object_name is null
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(logo|cover)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
  then
    return false;
  end if;

  v_restaurant_id := pg_catalog.split_part(p_object_name, '/', 1)::uuid;

  return exists (
    select 1
    from public.restaurants as restaurant
    join public.memberships as membership
      on membership.restaurant_id = restaurant.id
    where restaurant.id = v_restaurant_id
      and (
        restaurant.status = 'draft'
        or (p_allow_active and restaurant.status = 'active')
      )
      and membership.user_id = actor_id
      and membership.status = 'active'
  );
end;
$function$;
