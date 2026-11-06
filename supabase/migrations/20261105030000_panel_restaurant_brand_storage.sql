insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-brand',
  'restaurant-brand',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists panel_brand_read_member on storage.objects;
create policy panel_brand_read_member
on storage.objects for select to authenticated
using (
  bucket_id = 'restaurant-brand'
  and name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.restaurants as restaurant
    join public.memberships as membership on membership.restaurant_id = restaurant.id
    where restaurant.id::text = pg_catalog.split_part(name, '/', 1)
      and restaurant.status in ('draft', 'active')
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

drop policy if exists panel_brand_read_public_active on storage.objects;
create policy panel_brand_read_public_active
on storage.objects for select to anon
using (
  bucket_id = 'restaurant-brand'
  and name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.restaurants as restaurant
    where restaurant.id::text = pg_catalog.split_part(name, '/', 1)
      and restaurant.status = 'active'
  )
);

drop policy if exists panel_brand_insert_draft_member on storage.objects;
create policy panel_brand_insert_draft_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'restaurant-brand'
  and name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.restaurants as restaurant
    join public.memberships as membership on membership.restaurant_id = restaurant.id
    where restaurant.id::text = pg_catalog.split_part(name, '/', 1)
      and restaurant.status = 'draft'
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

drop policy if exists panel_brand_delete_draft_member on storage.objects;
create policy panel_brand_delete_draft_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'restaurant-brand'
  and name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.restaurants as restaurant
    join public.memberships as membership on membership.restaurant_id = restaurant.id
    where restaurant.id::text = pg_catalog.split_part(name, '/', 1)
      and restaurant.status = 'draft'
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
);

