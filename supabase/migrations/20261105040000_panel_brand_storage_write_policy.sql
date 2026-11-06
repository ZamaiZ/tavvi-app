-- Avalia a membership com privilégios do dono da função para evitar que a RLS
-- recursiva das tabelas de restaurantes/memberships esconda a linha do uploader.
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
  restaurant_id uuid;
begin
  if actor_id is null or p_object_name is null
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(logo|cover)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
  then
    return false;
  end if;

  restaurant_id := pg_catalog.split_part(p_object_name, '/', 1)::uuid;

  return exists (
    select 1
    from public.restaurants as restaurant
    join public.memberships as membership
      on membership.restaurant_id = restaurant.id
    where restaurant.id = restaurant_id
      and (
        restaurant.status = 'draft'
        or (p_allow_active and restaurant.status = 'active')
      )
      and membership.user_id = actor_id
      and membership.status = 'active'
  );
end;
$function$;

revoke all on function public.panel_brand_storage_can_write(text, boolean) from PUBLIC, anon, authenticated;
grant execute on function public.panel_brand_storage_can_write(text, boolean) to authenticated;

drop policy if exists panel_brand_insert_draft_member on storage.objects;
create policy panel_brand_insert_draft_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'restaurant-brand'
  and public.panel_brand_storage_can_write(name, false)
);

drop policy if exists panel_brand_delete_draft_member on storage.objects;
create policy panel_brand_delete_draft_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'restaurant-brand'
  and public.panel_brand_storage_can_write(name, true)
);
