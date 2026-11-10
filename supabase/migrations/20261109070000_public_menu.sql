-- Leitura pública deliberadamente estreita, isolada da leitura de perfil.
create or replace function public.get_public_restaurant_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'slug', restaurant.slug,
    'presentation', restaurant.menu_presentation,
    'categories', coalesce((
      select pg_catalog.jsonb_agg(category_json.value order by category.position, category.id)
      from public.menu_categories category
      cross join lateral (
        select pg_catalog.jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'description', category.description,
          'items', coalesce((
            select pg_catalog.jsonb_agg(item_json.value order by item.position, item.id)
            from public.menu_items item
            cross join lateral (
              select pg_catalog.jsonb_build_object(
                'id', item.id,
                'name', item.name,
                'description', item.description,
                'isAvailable', item.is_available,
                'highlights', to_jsonb(item.highlights),
                'pricing', case when item.price_mode = 'single'
                  then pg_catalog.jsonb_build_object('mode', 'single', 'basePriceCents', item.base_price_cents)
                  else pg_catalog.jsonb_build_object('mode', 'variants', 'variants', coalesce((
                    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'id', variant.id, 'name', variant.name, 'priceCents', variant.price_cents,
                      'isAvailable', variant.is_available
                    ) order by variant.position, variant.id)
                    from public.menu_item_variants variant
                    where variant.item_id = item.id and variant.restaurant_id = restaurant.id
                  ), '[]'::jsonb)) end,
                'attributes', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'kind', link.kind, 'label', attribute.label, 'qualifier', link.qualifier
                  ) order by link.kind, attribute.label)
                  from public.menu_item_attributes link
                  join public.restaurant_menu_attributes attribute
                    on attribute.id = link.attribute_id and attribute.restaurant_id = link.restaurant_id
                  where link.item_id = item.id and link.restaurant_id = restaurant.id
                ), '[]'::jsonb),
                'media', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'id', media.id, 'kind', media.kind, 'altText', media.alt_text,
                    'hasPoster', media.poster_path is not null,
                    'width', media.width, 'height', media.height, 'durationMs', media.duration_ms
                  ) order by media.position, media.id)
                  from public.menu_item_media media
                  where media.item_id = item.id and media.restaurant_id = restaurant.id
                ), '[]'::jsonb)
              ) as value
            ) item_json
            where item.restaurant_id = restaurant.id
              and item.category_id = category.id
              and item.is_visible
              and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = restaurant.id)
          ), '[]'::jsonb)
        ) as value
      ) category_json
      where category.restaurant_id = restaurant.id and category.is_visible
        and exists (
          select 1 from public.menu_items item
          join public.menu_item_media media on media.item_id = item.id and media.restaurant_id = item.restaurant_id
          where item.restaurant_id = restaurant.id and item.category_id = category.id and item.is_visible
        )
    ), '[]'::jsonb)
  )
  from public.restaurants restaurant
  where restaurant.slug = p_slug and restaurant.status = 'active' and restaurant.menu_status = 'published';
$function$;

create or replace function public.get_public_menu_media_path(p_slug text, p_media_id uuid, p_poster boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'bucket', case when p_poster then 'menu-images' when media.kind = 'image' then 'menu-images' else 'menu-videos' end,
    'path', case when p_poster then media.poster_path else media.storage_path end,
    'kind', media.kind
  )
  from public.menu_item_media media
  join public.menu_items item on item.id = media.item_id and item.restaurant_id = media.restaurant_id
  join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
  join public.restaurants restaurant on restaurant.id = item.restaurant_id
  where media.id = p_media_id and restaurant.slug = p_slug
    and restaurant.status = 'active' and restaurant.menu_status = 'published'
    and category.is_visible and item.is_visible and media.storage_path is not null
    and (not p_poster or media.poster_path is not null);
$function$;

create or replace function public.public_menu_storage_can_read(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(exists (
    select 1
    from public.menu_item_media media
    join public.menu_items item on item.id = media.item_id and item.restaurant_id = media.restaurant_id
    join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
    join public.restaurants restaurant on restaurant.id = item.restaurant_id
    where restaurant.status = 'active' and restaurant.menu_status = 'published'
      and category.is_visible and item.is_visible
      and (media.storage_path = p_object_name or media.poster_path = p_object_name)
  ), false);
$function$;

revoke all on function public.get_public_restaurant_menu(text) from public, authenticated;
revoke all on function public.get_public_menu_media_path(text, uuid, boolean) from public, authenticated;
revoke all on function public.public_menu_storage_can_read(text) from public, authenticated;
grant execute on function public.get_public_restaurant_menu(text) to anon, authenticated;
grant execute on function public.get_public_menu_media_path(text, uuid, boolean) to anon, authenticated;
grant execute on function public.public_menu_storage_can_read(text) to anon, authenticated;

create policy menu_storage_public_select on storage.objects
for select to anon, authenticated
using (
  bucket_id in ('menu-images', 'menu-videos')
  and public.public_menu_storage_can_read(name)
);
