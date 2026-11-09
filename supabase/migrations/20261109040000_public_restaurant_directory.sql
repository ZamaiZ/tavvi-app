-- Lista pública de restaurantes ativos com a menor projeção necessária à home.
-- A tabela restaurants continua sem leitura anônima direta.
create function public.list_public_restaurants(
  p_search text default '',
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized_search text;
  page_number integer := coalesce(p_page, 1);
  page_offset integer;
  result_rows jsonb;
  has_more boolean;
begin
  if p_search is null
    or pg_catalog.char_length(p_search) > 120
    or page_number < 1
    or page_number > 1000 then
    return pg_catalog.jsonb_build_object(
      'rows', '[]'::jsonb,
      'hasMore', false
    );
  end if;

  normalized_search := pg_catalog.translate(
    pg_catalog.lower(pg_catalog.btrim(p_search)),
    'áàãâäéèêëíìîïóòõôöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
  page_offset := (page_number - 1) * 20;

  with restaurant_data as (
    select
      restaurant.slug,
      restaurant.name,
      restaurant.segment,
      restaurant.logo_path is not null as has_logo,
      nullif(
        pg_catalog.jsonb_strip_nulls(
          pg_catalog.jsonb_build_object(
            'cep', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'cep'), ''),
            'street', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'street'), ''),
            'number', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'number'), ''),
            'complement', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'complement'), ''),
            'district', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'district'), ''),
            'city', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'city'), ''),
            'state', nullif(pg_catalog.btrim(restaurant.contact -> 'address' ->> 'state'), '')
          )
        ),
        '{}'::jsonb
      ) as address,
      pg_catalog.translate(
        pg_catalog.lower(
          pg_catalog.concat_ws(
            ' ',
            restaurant.name,
            restaurant.segment,
            restaurant.contact -> 'address' ->> 'cep',
            restaurant.contact -> 'address' ->> 'street',
            restaurant.contact -> 'address' ->> 'number',
            restaurant.contact -> 'address' ->> 'complement',
            restaurant.contact -> 'address' ->> 'district',
            restaurant.contact -> 'address' ->> 'city',
            restaurant.contact -> 'address' ->> 'state'
          )
        ),
        'áàãâäéèêëíìîïóòõôöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ) as searchable_text,
      pg_catalog.translate(
        pg_catalog.lower(restaurant.name),
        'áàãâäéèêëíìîïóòõôöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ) as normalized_name
    from public.restaurants as restaurant
    where restaurant.status = 'active'
      and restaurant.slug not in ('admin', 'painel')
  ), matched_restaurants as (
    select restaurant_data.*
    from restaurant_data
    where normalized_search = ''
      or pg_catalog.strpos(restaurant_data.searchable_text, normalized_search) > 0
  ), page_rows as (
    select matched_restaurants.*
    from matched_restaurants
    order by matched_restaurants.normalized_name, matched_restaurants.slug
    offset page_offset
    limit 21
  ), ranked_page_rows as (
    select
      page_rows.*,
      pg_catalog.row_number() over (
        order by page_rows.normalized_name, page_rows.slug
      ) as page_row_number
    from page_rows
  )
  select
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'slug', ranked_page_rows.slug,
          'name', ranked_page_rows.name,
          'segment', ranked_page_rows.segment,
          'hasLogo', ranked_page_rows.has_logo,
          'address', ranked_page_rows.address
        ) order by ranked_page_rows.page_row_number
      ) filter (where ranked_page_rows.page_row_number <= 20),
      '[]'::jsonb
    ),
    coalesce(pg_catalog.bool_or(ranked_page_rows.page_row_number > 20), false)
  into result_rows, has_more
  from ranked_page_rows;

  return pg_catalog.jsonb_build_object(
    'rows', result_rows,
    'hasMore', has_more
  );
end;
$function$;

revoke all on function public.list_public_restaurants(text, integer) from PUBLIC, anon, authenticated;
grant execute on function public.list_public_restaurants(text, integer) to anon;
