-- Canonical public menu modes, plus member-scoped editing of active profile fields.
update public.restaurants
set menu_presentation = 'standard'
where menu_presentation in ('catalog-list', 'catalog-grid');

alter table public.restaurants
  drop constraint if exists restaurants_menu_presentation_check,
  add constraint restaurants_menu_presentation_check
    check (menu_presentation in ('immersive', 'standard'));

-- Keep the strict validator from the onboarding migration and translate only the
-- newly canonical Standard value for its legacy presentation check.
create or replace function public.panel_onboarding_profile_is_valid(
  p_profile jsonb,
  p_complete boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    pg_catalog.jsonb_typeof(p_profile) = 'object'
    and (p_profile ->> 'menuPresentation') in ('immersive', 'standard')
    and public.panel_onboarding_profile_is_valid_base(
      pg_catalog.jsonb_set(p_profile, '{menuPresentation}', '"immersive"'::jsonb, false),
      p_complete
    )
    and (
      not p_complete or (
        pg_catalog.length(pg_catalog.regexp_replace(p_profile -> 'contact' ->> 'whatsapp', '[^0-9]', '', 'g')) in (10, 11)
        and (p_profile -> 'contact' -> 'address' ->> 'cep') ~ '^[0-9]{5}-?[0-9]{3}$'
        and pg_catalog.length(pg_catalog.btrim(p_profile -> 'contact' -> 'address' ->> 'street')) >= 2
        and pg_catalog.length(pg_catalog.btrim(p_profile -> 'contact' -> 'address' ->> 'number')) >= 1
        and pg_catalog.length(pg_catalog.btrim(p_profile -> 'contact' -> 'address' ->> 'district')) >= 2
        and pg_catalog.length(pg_catalog.btrim(p_profile -> 'contact' -> 'address' ->> 'city')) >= 2
        and (p_profile -> 'contact' -> 'address' ->> 'state') ~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'
        and (p_profile -> 'contact' ->> 'mapsUrl' = '' or p_profile -> 'contact' ->> 'googleReviewUrl' <> '')
      )
    ), false
  );
$function$;

create or replace function public.save_active_restaurant_identity(
  p_restaurant_id uuid,
  p_identity jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  restaurant_row public.restaurants%rowtype;
  full_profile jsonb;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_identity is null
    or pg_catalog.jsonb_typeof(p_identity) is distinct from 'object'
    or not (p_identity ?& array['segment', 'theme', 'menuPresentation', 'logoPath', 'coverPath'])
    or (p_identity - array['segment', 'theme', 'menuPresentation', 'logoPath', 'coverPath']) <> '{}'::jsonb
  then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select restaurant.* into restaurant_row
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.status = 'active'
    and exists (
      select 1 from public.memberships membership
      where membership.restaurant_id = restaurant.id
        and membership.user_id = actor_id
        and membership.status = 'active'
    )
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if (p_identity -> 'logoPath' is distinct from 'null'::jsonb and
      (p_identity ->> 'logoPath') !~ ('^' || restaurant_row.id::text || '/logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'))
    or (p_identity -> 'coverPath' is distinct from 'null'::jsonb and
      (p_identity ->> 'coverPath') !~ ('^' || restaurant_row.id::text || '/cover/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'))
  then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  full_profile := pg_catalog.jsonb_build_object(
    'name', restaurant_row.name,
    'description', restaurant_row.description,
    'segment', p_identity -> 'segment',
    'theme', p_identity -> 'theme',
    'menuPresentation', p_identity -> 'menuPresentation',
    'logoPath', p_identity -> 'logoPath',
    'coverPath', p_identity -> 'coverPath',
    'contact', restaurant_row.contact
  );
  if not public.panel_onboarding_profile_is_valid(full_profile, false) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  update public.restaurants restaurant
  set segment = nullif(p_identity ->> 'segment', ''),
      theme = p_identity -> 'theme',
      menu_presentation = p_identity ->> 'menuPresentation',
      logo_path = nullif(p_identity ->> 'logoPath', 'null'),
      cover_path = nullif(p_identity ->> 'coverPath', 'null')
  where restaurant.id = p_restaurant_id;

  return pg_catalog.jsonb_build_object('ok', true, 'restaurantId', p_restaurant_id);
end;
$function$;

create or replace function public.save_active_restaurant_contact(
  p_restaurant_id uuid,
  p_contact_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  restaurant_row public.restaurants%rowtype;
  full_profile jsonb;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_contact_profile is null
    or pg_catalog.jsonb_typeof(p_contact_profile) is distinct from 'object'
    or not (p_contact_profile ?& array['name', 'description', 'contact'])
    or (p_contact_profile - array['name', 'description', 'contact']) <> '{}'::jsonb
  then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select restaurant.* into restaurant_row
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.status = 'active'
    and exists (
      select 1 from public.memberships membership
      where membership.restaurant_id = restaurant.id
        and membership.user_id = actor_id
        and membership.status = 'active'
    )
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  full_profile := pg_catalog.jsonb_build_object(
    'name', p_contact_profile -> 'name',
    'description', p_contact_profile -> 'description',
    'segment', restaurant_row.segment,
    'theme', restaurant_row.theme,
    'menuPresentation', restaurant_row.menu_presentation,
    'logoPath', restaurant_row.logo_path,
    'coverPath', restaurant_row.cover_path,
    'contact', p_contact_profile -> 'contact'
  );
  if not public.panel_onboarding_profile_is_valid(full_profile, true) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  update public.restaurants restaurant
  set name = pg_catalog.btrim(p_contact_profile ->> 'name'),
      description = p_contact_profile ->> 'description',
      contact = p_contact_profile -> 'contact'
  where restaurant.id = p_restaurant_id;

  return pg_catalog.jsonb_build_object('ok', true, 'restaurantId', p_restaurant_id);
end;
$function$;

revoke all on function public.save_active_restaurant_identity(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.save_active_restaurant_contact(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_active_restaurant_identity(uuid, jsonb) to authenticated;
grant execute on function public.save_active_restaurant_contact(uuid, jsonb) to authenticated;

-- Existing Storage helper already validates the active membership and object path.
drop policy if exists panel_brand_insert_draft_member on storage.objects;
create policy panel_brand_insert_draft_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'restaurant-brand'
  and public.panel_brand_storage_can_write(name, true)
);
