-- Correct existing installations even if the preceding migration was applied before this fix.
do $migration$
declare
  function_name text;
  definition text;
begin
  foreach function_name in array array['panel_onboarding_profile_is_valid', 'panel_onboarding_profile_is_valid_base'] loop
    select pg_catalog.pg_get_functiondef(p.oid) into definition
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = function_name
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_profile jsonb, p_complete boolean';
    if definition is not null and pg_catalog.strpos(definition, '{10,300}') > 0 then
      execute pg_catalog.replace(definition, '{10,300}', '{10,255}[A-Za-z0-9_-]{0,45}');
    end if;
  end loop;
end;
$migration$;

drop policy if exists panel_brand_read_member on storage.objects;
create policy panel_brand_read_member on storage.objects for select to authenticated
using (
  bucket_id = 'restaurant-brand'
  and storage.objects.name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.restaurants restaurant
    join public.memberships membership on membership.restaurant_id = restaurant.id
    where restaurant.id::text = pg_catalog.split_part(storage.objects.name, '/', 1)
      and restaurant.status in ('draft', 'active')
      and membership.user_id = (select auth.uid()) and membership.status = 'active'
  )
);

drop policy if exists panel_brand_read_public_active on storage.objects;
-- Anonymous callers cannot read restaurants directly through RLS. This helper
-- answers only whether a well-formed brand object belongs to an active restaurant.
create or replace function public.panel_brand_public_active(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    object_name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
    and exists (
      select 1 from public.restaurants restaurant
      where restaurant.id::text = pg_catalog.split_part(object_name, '/', 1)
        and restaurant.status = 'active'
    ), false
  );
$function$;

revoke all on function public.panel_brand_public_active(text) from public, anon, authenticated;
grant execute on function public.panel_brand_public_active(text) to anon;

create policy panel_brand_read_public_active on storage.objects for select to anon
using (
  bucket_id = 'restaurant-brand'
  and public.panel_brand_public_active(storage.objects.name)
);
