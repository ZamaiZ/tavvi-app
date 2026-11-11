-- Preserve visible items with no media in the public DTO. The application
-- renders those items with a visual fallback instead of dropping them.
drop trigger if exists menu_items_require_media on public.menu_items;
drop trigger if exists menu_item_media_preserve_parent_media on public.menu_item_media;
drop function if exists public.enforce_menu_item_has_media();
drop function if exists public.enforce_menu_item_media_rows();
drop function if exists public.assert_menu_item_has_media(uuid, uuid);

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
          ), '[]'::jsonb)
        ) as value
      ) category_json
      where category.restaurant_id = restaurant.id and category.is_visible
        and exists (
          select 1 from public.menu_items item
          where item.restaurant_id = restaurant.id and item.category_id = category.id and item.is_visible
        )
    ), '[]'::jsonb)
  )
  from public.restaurants restaurant
  where restaurant.slug = p_slug and restaurant.status = 'active' and restaurant.menu_status = 'published';
$function$;

revoke all on function public.get_public_restaurant_menu(text) from public, authenticated;
grant execute on function public.get_public_restaurant_menu(text) to anon, authenticated;
