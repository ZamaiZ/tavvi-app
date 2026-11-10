-- Domínio do cardápio do Painel. Publicação é independente do estado do restaurante.

alter table public.restaurants
  add column if not exists menu_status text not null default 'draft'
    check (menu_status in ('draft', 'published'));

comment on column public.restaurants.menu_status is
  'Publicação do cardápio; não altera restaurants.status.';

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  position integer not null default 0 check (position >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (id, restaurant_id)
);

create index menu_categories_restaurant_order_idx
  on public.menu_categories (restaurant_id, position, id);

create trigger menu_categories_set_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 600),
  price_mode text not null default 'single' check (price_mode in ('single', 'variants')),
  base_price_cents integer,
  is_visible boolean not null default true,
  is_available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  highlights text[] not null default '{}'::text[]
    check (cardinality(highlights) <= 10),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (id, restaurant_id),
  constraint menu_items_pricing_configuration_check check (
    (price_mode = 'single' and base_price_cents is not null and base_price_cents >= 0)
    or (price_mode = 'variants' and base_price_cents is null)
  ),
  constraint menu_items_category_same_restaurant
    foreign key (category_id, restaurant_id)
    references public.menu_categories (id, restaurant_id) on delete cascade
);

create index menu_items_category_order_idx
  on public.menu_items (restaurant_id, category_id, position, id);

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

create table public.menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  item_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  price_cents integer not null check (price_cents >= 0),
  position integer not null default 0 check (position >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint menu_item_variants_item_same_restaurant
    foreign key (item_id, restaurant_id)
    references public.menu_items (id, restaurant_id) on delete cascade
);

create index menu_item_variants_item_order_idx
  on public.menu_item_variants (restaurant_id, item_id, position, id);

create unique index menu_item_variants_item_name_key
  on public.menu_item_variants (item_id, lower(btrim(name)));

create trigger menu_item_variants_set_updated_at
before update on public.menu_item_variants
for each row execute function public.set_updated_at();

create table public.restaurant_menu_attributes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null check (kind in ('diet', 'allergen')),
  label text not null check (char_length(btrim(label)) between 2 and 40),
  is_system boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique (id, restaurant_id, kind)
);

create unique index restaurant_menu_attributes_label_key
  on public.restaurant_menu_attributes (restaurant_id, kind, lower(btrim(label)));

create table public.menu_item_attributes (
  restaurant_id uuid not null,
  item_id uuid not null,
  attribute_id uuid not null,
  kind text not null check (kind in ('diet', 'allergen')),
  qualifier text check (qualifier in ('contains', 'may_contain')),
  created_at timestamptz not null default statement_timestamp(),
  primary key (item_id, attribute_id),
  constraint menu_item_attributes_item_same_restaurant
    foreign key (item_id, restaurant_id)
    references public.menu_items (id, restaurant_id) on delete cascade,
  constraint menu_item_attributes_definition_same_restaurant
    foreign key (attribute_id, restaurant_id, kind)
    references public.restaurant_menu_attributes (id, restaurant_id, kind) on delete cascade,
  constraint menu_item_attributes_qualifier_kind_check check (
    (kind = 'allergen' and qualifier is not null)
    or (kind = 'diet' and qualifier is null)
  )
);

create index menu_item_attributes_item_idx
  on public.menu_item_attributes (restaurant_id, item_id);

create table public.menu_item_media (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  item_id uuid not null,
  kind text not null check (kind in ('image', 'video')),
  storage_path text not null unique,
  poster_path text unique,
  alt_text text not null default '' check (char_length(alt_text) <= 180),
  width integer check (width is null or width between 1 and 10000),
  height integer check (height is null or height between 1 and 10000),
  duration_ms integer check (duration_ms is null or duration_ms between 1 and 15000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default statement_timestamp(),
  constraint menu_item_media_item_same_restaurant
    foreign key (item_id, restaurant_id)
    references public.menu_items (id, restaurant_id) on delete cascade,
  constraint menu_item_media_object_path_check check (
    storage_path ~ ('^' || restaurant_id::text || '/' || item_id::text || '/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif|mp4|webm)$')
  ),
  constraint menu_item_media_poster_path_check check (
    poster_path is null or poster_path ~ ('^' || restaurant_id::text || '/' || item_id::text || '/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif)$')
  ),
  constraint menu_item_media_poster_kind_check check (kind = 'video' or poster_path is null)
);

create index menu_item_media_item_order_idx
  on public.menu_item_media (restaurant_id, item_id, position, id);

create or replace function public.panel_menu_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_restaurant_id is not null
    and (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships as membership
      join public.restaurants as restaurant on restaurant.id = membership.restaurant_id
      where membership.restaurant_id = p_restaurant_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and restaurant.status = 'active'
    ),
    false
  );
$function$;

revoke all on function public.panel_menu_member(uuid) from public, anon, authenticated;
grant execute on function public.panel_menu_member(uuid) to authenticated;

create or replace function public.panel_menu_storage_member(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif|mp4|webm)$'
    and exists (
      select 1 from public.restaurants restaurant
      join public.memberships membership on membership.restaurant_id = restaurant.id
      where restaurant.id::text = pg_catalog.split_part(p_object_name, '/', 1)
        and restaurant.status = 'active'
        and membership.user_id = (select auth.uid()) and membership.status = 'active'
    ),
    false
  );
$function$;

revoke all on function public.panel_menu_storage_member(text) from public, anon, authenticated;
grant execute on function public.panel_menu_storage_member(text) to authenticated;

create or replace function public.panel_menu_storage_can_delete(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    public.panel_menu_storage_member(p_object_name)
    and not exists (
      select 1 from public.menu_item_media media
      where media.storage_path = p_object_name or media.poster_path = p_object_name
    ),
    false
  );
$function$;

revoke all on function public.panel_menu_storage_can_delete(text) from public, anon, authenticated;
grant execute on function public.panel_menu_storage_can_delete(text) to authenticated;

create or replace function public.seed_restaurant_menu_attributes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.restaurant_menu_attributes (restaurant_id, kind, label, is_system)
  values
    (new.id, 'diet', 'Vegetariano', true),
    (new.id, 'diet', 'Vegano', true),
    (new.id, 'diet', 'Sem glúten', true),
    (new.id, 'diet', 'Sem lactose', true),
    (new.id, 'diet', 'Picante', true),
    (new.id, 'allergen', 'Leite', true),
    (new.id, 'allergen', 'Ovos', true),
    (new.id, 'allergen', 'Trigo/glúten', true),
    (new.id, 'allergen', 'Soja', true),
    (new.id, 'allergen', 'Amendoim', true),
    (new.id, 'allergen', 'Castanhas', true),
    (new.id, 'allergen', 'Peixe', true),
    (new.id, 'allergen', 'Crustáceos', true),
    (new.id, 'allergen', 'Gergelim', true)
  on conflict do nothing;
  return new;
end;
$function$;

create trigger restaurants_seed_menu_attributes
after insert on public.restaurants
for each row execute function public.seed_restaurant_menu_attributes();

revoke all on function public.seed_restaurant_menu_attributes() from public, anon, authenticated;

insert into public.restaurant_menu_attributes (restaurant_id, kind, label, is_system)
select restaurant.id, defaults.kind, defaults.label, true
from public.restaurants as restaurant
cross join (values
  ('diet', 'Vegetariano'), ('diet', 'Vegano'), ('diet', 'Sem glúten'),
  ('diet', 'Sem lactose'), ('diet', 'Picante'),
  ('allergen', 'Leite'), ('allergen', 'Ovos'), ('allergen', 'Trigo/glúten'),
  ('allergen', 'Soja'), ('allergen', 'Amendoim'), ('allergen', 'Castanhas'),
  ('allergen', 'Peixe'), ('allergen', 'Crustáceos'), ('allergen', 'Gergelim')
) as defaults(kind, label)
on conflict do nothing;

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_variants enable row level security;
alter table public.restaurant_menu_attributes enable row level security;
alter table public.menu_item_attributes enable row level security;
alter table public.menu_item_media enable row level security;

create policy menu_categories_select_member on public.menu_categories
for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy menu_items_select_member on public.menu_items
for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy menu_item_variants_select_member on public.menu_item_variants
for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy restaurant_menu_attributes_select_member on public.restaurant_menu_attributes
for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy menu_item_attributes_select_member on public.menu_item_attributes
for select to authenticated using (public.panel_menu_member(restaurant_id));
create policy menu_item_media_select_member on public.menu_item_media
for select to authenticated using (public.panel_menu_member(restaurant_id));

revoke all on table public.menu_categories, public.menu_items, public.menu_item_variants,
  public.restaurant_menu_attributes, public.menu_item_attributes, public.menu_item_media
from public, anon, authenticated;
grant select on table public.menu_categories, public.menu_items, public.menu_item_variants,
  public.restaurant_menu_attributes, public.menu_item_attributes, public.menu_item_media
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-images', 'menu-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]),
  ('menu-videos', 'menu-videos', false, 10485760, array['video/mp4', 'video/webm']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy menu_storage_member_select on storage.objects
for select to authenticated
using (
  bucket_id in ('menu-images', 'menu-videos')
  and public.panel_menu_storage_member(name)
);

create policy menu_storage_member_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('menu-images', 'menu-videos')
  and public.panel_menu_storage_member(name)
  and ((bucket_id = 'menu-images' and name ~ '[.](jpg|jpeg|png|webp|avif)$')
    or (bucket_id = 'menu-videos' and name ~ '[.](mp4|webm)$'))
);

create policy menu_storage_member_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('menu-images', 'menu-videos')
  and public.panel_menu_storage_can_delete(name)
);

create or replace function public.save_menu_category(
  p_restaurant_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_is_visible boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  category_id_value uuid := coalesce(p_category_id, pg_catalog.gen_random_uuid());
  position_value integer;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    raise exception using errcode = '42501', message = 'menu_unauthorized';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 2 and 80
    or pg_catalog.char_length(coalesce(p_description, '')) > 300 then
    raise exception using errcode = '22023', message = 'menu_invalid_category';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select coalesce(max(position) + 1, 0) into position_value
  from public.menu_categories where restaurant_id = p_restaurant_id;

  if p_category_id is null then
    insert into public.menu_categories (id, restaurant_id, name, description, is_visible, position)
    values (category_id_value, p_restaurant_id, pg_catalog.btrim(p_name), coalesce(p_description, ''), coalesce(p_is_visible, true), position_value);
  else
    update public.menu_categories set
      name = pg_catalog.btrim(p_name), description = coalesce(p_description, ''), is_visible = p_is_visible
    where id = p_category_id and restaurant_id = p_restaurant_id;
    if not found then raise exception using errcode = 'P0002', message = 'menu_category_not_found'; end if;
    if (select menu_status from public.restaurants where id = p_restaurant_id) = 'published'
      and not coalesce(p_is_visible, true)
      and not exists (
        select 1 from public.menu_items item
        join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
        join public.menu_item_media media on media.item_id = item.id and media.restaurant_id = item.restaurant_id
        where item.restaurant_id = p_restaurant_id and item.is_visible and category.is_visible
          and category.id <> p_category_id
      ) then
      raise exception using errcode = 'P0001', message = 'published_menu_empty';
    end if;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'categoryId', category_id_value);
end;
$function$;

create or replace function public.save_menu_attribute(
  p_restaurant_id uuid,
  p_kind text,
  p_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  attribute_id_value uuid;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    raise exception using errcode = '42501', message = 'menu_unauthorized';
  end if;
  if p_kind not in ('diet', 'allergen') or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_label, ''))) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'menu_invalid_attribute';
  end if;

  insert into public.restaurant_menu_attributes (restaurant_id, kind, label, is_system)
  values (p_restaurant_id, p_kind, pg_catalog.btrim(p_label), false)
  on conflict do nothing
  returning id into attribute_id_value;

  if attribute_id_value is null then
    select id into attribute_id_value from public.restaurant_menu_attributes
    where restaurant_id = p_restaurant_id and kind = p_kind and lower(btrim(label)) = lower(pg_catalog.btrim(p_label));
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'attributeId', attribute_id_value);
end;
$function$;

create or replace function public.save_menu_item(
  p_restaurant_id uuid,
  p_item_id uuid,
  p_category_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  item_id_value uuid := coalesce(p_item_id, pg_catalog.gen_random_uuid());
  price_mode_value text;
  base_price_value integer;
  variant_value jsonb;
  attribute_value jsonb;
  media_value jsonb;
  media_bucket text;
  media_path text;
  poster_path_value text;
  media_kind_value text;
  media_count integer;
  variant_ids uuid[] := array[]::uuid[];
  variant_position integer;
  variant_id_value uuid;
  previous_category_id uuid;
  next_item_position integer;
  removed_paths jsonb := '[]'::jsonb;
  menu_is_published boolean;
begin
  if not public.panel_menu_member(p_restaurant_id) then
    raise exception using errcode = '42501', message = 'menu_unauthorized';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_payload -> 'name') is distinct from 'string'
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_payload ->> 'name', ''))) not between 2 and 120
    or pg_catalog.jsonb_typeof(p_payload -> 'description') not in ('string', 'null')
    or pg_catalog.char_length(coalesce(p_payload ->> 'description', '')) > 600 then
    raise exception using errcode = '22023', message = 'menu_invalid_item';
  end if;

  if pg_catalog.jsonb_typeof(coalesce(p_payload -> 'media', '[]'::jsonb)) is distinct from 'array'
    or pg_catalog.jsonb_typeof(coalesce(p_payload -> 'attributes', '[]'::jsonb)) is distinct from 'array'
    or pg_catalog.jsonb_typeof(coalesce(p_payload -> 'highlights', '[]'::jsonb)) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'menu_invalid_item_collections';
  end if;
  if pg_catalog.jsonb_array_length(coalesce(p_payload -> 'media', '[]'::jsonb)) > 6 then
    raise exception using errcode = '22023', message = 'menu_media_limit';
  end if;
  if pg_catalog.jsonb_array_length(coalesce(p_payload -> 'attributes', '[]'::jsonb)) > 30
    or pg_catalog.jsonb_array_length(coalesce(p_payload -> 'highlights', '[]'::jsonb)) > 10
    or exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(p_payload -> 'highlights', '[]'::jsonb)) as highlight(value)
      where pg_catalog.jsonb_typeof(highlight.value) is distinct from 'string'
        or pg_catalog.char_length(pg_catalog.btrim(highlight.value #>> '{}')) not between 1 and 30
    ) then
    raise exception using errcode = '22023', message = 'menu_invalid_item_collections';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select menu_status = 'published' into menu_is_published from public.restaurants where id = p_restaurant_id;
  if not exists (select 1 from public.menu_categories where id = p_category_id and restaurant_id = p_restaurant_id) then
    raise exception using errcode = 'P0002', message = 'menu_category_not_found';
  end if;
  if exists (select 1 from public.menu_items where id = item_id_value and restaurant_id <> p_restaurant_id) then
    raise exception using errcode = '42501', message = 'menu_item_unavailable';
  end if;
  select category_id into previous_category_id from public.menu_items
  where id = item_id_value and restaurant_id = p_restaurant_id;
  if previous_category_id is distinct from p_category_id then
    select coalesce(max(position) + 1, 0) into next_item_position from public.menu_items
    where restaurant_id = p_restaurant_id and category_id = p_category_id;
  end if;

  media_count := pg_catalog.jsonb_array_length(coalesce(p_payload -> 'media', '[]'::jsonb));

  price_mode_value := p_payload #>> '{pricing,mode}';
  if price_mode_value = 'single' then
    base_price_value := (p_payload #>> '{pricing,basePriceCents}')::integer;
    if base_price_value is null or base_price_value < 0 or base_price_value > 99999999 then raise exception using errcode = '22023', message = 'menu_invalid_price'; end if;
  elsif price_mode_value = 'variants' then
    if pg_catalog.jsonb_typeof(p_payload #> '{pricing,variants}') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'menu_invalid_variants';
    end if;
    if pg_catalog.jsonb_array_length(p_payload #> '{pricing,variants}') not between 1 and 30 then
      raise exception using errcode = '22023', message = 'menu_invalid_variants';
    end if;
    base_price_value := null;
  else
    raise exception using errcode = '22023', message = 'menu_invalid_price_mode';
  end if;

  if p_item_id is not null then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('bucket', files.bucket_id, 'path', files.path)), '[]'::jsonb)
    into removed_paths
    from (
      select case when media.kind = 'image' then 'menu-images' else 'menu-videos' end as bucket_id, media.storage_path as path
      from public.menu_item_media media
      where media.item_id = item_id_value and media.restaurant_id = p_restaurant_id
        and not exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(p_payload -> 'media', '[]'::jsonb)) as next_media(value)
          where next_media.value ->> 'id' = media.id::text and next_media.value ->> 'storagePath' = media.storage_path
        )
      union all
      select 'menu-images', media.poster_path
      from public.menu_item_media media
      where media.item_id = item_id_value and media.restaurant_id = p_restaurant_id and media.poster_path is not null
        and not exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(p_payload -> 'media', '[]'::jsonb)) as next_media(value)
          where next_media.value ->> 'id' = media.id::text and next_media.value ->> 'posterPath' = media.poster_path
        )
    ) as files;
  end if;

  insert into public.menu_items (id, restaurant_id, category_id, name, description, price_mode, base_price_cents, is_visible, is_available, position, highlights)
  values (
    item_id_value, p_restaurant_id, p_category_id, pg_catalog.btrim(p_payload ->> 'name'), coalesce(p_payload ->> 'description', ''),
    price_mode_value, base_price_value, coalesce((p_payload ->> 'isVisible')::boolean, true),
    coalesce((p_payload ->> 'isAvailable')::boolean, true),
    coalesce(next_item_position, (select position + 1 from public.menu_items where restaurant_id = p_restaurant_id and category_id = p_category_id order by position desc limit 1), 0),
    array(select pg_catalog.btrim(highlight.value) from pg_catalog.jsonb_array_elements_text(coalesce(p_payload -> 'highlights', '[]'::jsonb)) as highlight(value))
  )
  on conflict (id) do update set
    category_id = excluded.category_id, name = excluded.name, description = excluded.description,
    price_mode = excluded.price_mode, base_price_cents = excluded.base_price_cents,
    is_visible = excluded.is_visible, is_available = excluded.is_available, highlights = excluded.highlights,
    position = case when public.menu_items.category_id is distinct from excluded.category_id then excluded.position else public.menu_items.position end
  where public.menu_items.restaurant_id = p_restaurant_id;

  if not exists (select 1 from public.menu_items where id = item_id_value and restaurant_id = p_restaurant_id) then
    raise exception using errcode = '42501', message = 'menu_item_unavailable';
  end if;

  if price_mode_value = 'variants' then
    for variant_value, variant_position in
      select variant.value, variant.ordinality::integer
      from pg_catalog.jsonb_array_elements(p_payload #> '{pricing,variants}') with ordinality as variant(value, ordinality)
    loop
      if pg_catalog.char_length(pg_catalog.btrim(coalesce(variant_value ->> 'name', ''))) not between 1 and 60
        or coalesce((variant_value ->> 'priceCents')::integer, -1) not between 0 and 99999999 then
        raise exception using errcode = '22023', message = 'menu_invalid_variant';
      end if;
      variant_id_value := coalesce((variant_value ->> 'id')::uuid, pg_catalog.gen_random_uuid());
      if variant_id_value = any(variant_ids) then
        raise exception using errcode = '22023', message = 'menu_duplicate_variant';
      end if;
      if exists (
        select 1 from public.menu_item_variants variant
        where variant.id = variant_id_value
          and (variant.restaurant_id <> p_restaurant_id or variant.item_id <> item_id_value)
      ) then raise exception using errcode = '42501', message = 'menu_variant_unavailable'; end if;
      insert into public.menu_item_variants (id, restaurant_id, item_id, name, price_cents, position, is_available)
      values (
        variant_id_value, p_restaurant_id, item_id_value,
        pg_catalog.btrim(variant_value ->> 'name'), (variant_value ->> 'priceCents')::integer,
        variant_position - 1, coalesce((variant_value ->> 'isAvailable')::boolean, true)
      ) on conflict (id) do update set
        name = excluded.name, price_cents = excluded.price_cents,
        position = excluded.position, is_available = excluded.is_available
      where public.menu_item_variants.restaurant_id = p_restaurant_id
        and public.menu_item_variants.item_id = item_id_value;
      variant_ids := pg_catalog.array_append(variant_ids, variant_id_value);
    end loop;
    delete from public.menu_item_variants where item_id = item_id_value and restaurant_id = p_restaurant_id
      and not (id = any(variant_ids));
  else
    delete from public.menu_item_variants where item_id = item_id_value and restaurant_id = p_restaurant_id;
  end if;

  delete from public.menu_item_attributes where item_id = item_id_value and restaurant_id = p_restaurant_id;
  for attribute_value in select attribute.value from pg_catalog.jsonb_array_elements(coalesce(p_payload -> 'attributes', '[]'::jsonb)) as attribute(value) loop
    if not exists (
      select 1 from public.restaurant_menu_attributes attribute
      where attribute.id = (attribute_value ->> 'id')::uuid
        and attribute.restaurant_id = p_restaurant_id
        and attribute.kind = attribute_value ->> 'kind'
    ) then raise exception using errcode = '22023', message = 'menu_invalid_attribute'; end if;
    insert into public.menu_item_attributes (restaurant_id, item_id, attribute_id, kind, qualifier)
    values (
      p_restaurant_id, item_id_value, (attribute_value ->> 'id')::uuid, attribute_value ->> 'kind',
      nullif(attribute_value ->> 'qualifier', '')
    );
  end loop;

  delete from public.menu_item_media where item_id = item_id_value and restaurant_id = p_restaurant_id;
  for media_value in select media.value from pg_catalog.jsonb_array_elements(coalesce(p_payload -> 'media', '[]'::jsonb)) with ordinality as media(value, ordinality) loop
    media_kind_value := media_value ->> 'kind';
    media_bucket := case when media_kind_value = 'image' then 'menu-images' when media_kind_value = 'video' then 'menu-videos' else null end;
    media_path := media_value ->> 'storagePath';
    poster_path_value := nullif(media_value ->> 'posterPath', '');
    if media_bucket is null
      or media_path !~ ('^' || p_restaurant_id::text || '/' || item_id_value::text || '/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif|mp4|webm)$')
      or (media_kind_value = 'image' and media_path !~ '[.](jpg|jpeg|png|webp|avif)$')
      or (media_kind_value = 'video' and media_path !~ '[.](mp4|webm)$')
      or (media_kind_value = 'video' and nullif((media_value ->> 'durationMs')::integer, 0) is null)
      or nullif((media_value ->> 'durationMs')::integer, 0) > 15000
      or (media_kind_value = 'image' and nullif((media_value ->> 'durationMs')::integer, 0) is not null)
      or not exists (select 1 from storage.objects object where object.bucket_id = media_bucket and object.name = media_path) then
      raise exception using errcode = '22023', message = 'menu_media_object_missing';
    end if;
    if poster_path_value is not null and (
      media_kind_value <> 'video'
      or poster_path_value !~ ('^' || p_restaurant_id::text || '/' || item_id_value::text || '/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif)$')
      or not exists (select 1 from storage.objects object where object.bucket_id = 'menu-images' and object.name = poster_path_value)
    ) then raise exception using errcode = '22023', message = 'menu_media_poster_missing'; end if;

    insert into public.menu_item_media (id, restaurant_id, item_id, kind, storage_path, poster_path, alt_text, width, height, duration_ms, position)
    values (
      (media_value ->> 'id')::uuid, p_restaurant_id, item_id_value, media_kind_value, media_path, poster_path_value,
      coalesce(media_value ->> 'altText', ''), nullif((media_value ->> 'width')::integer, 0), nullif((media_value ->> 'height')::integer, 0),
      nullif((media_value ->> 'durationMs')::integer, 0), (media_value ->> 'position')::integer
    );
  end loop;

  if menu_is_published and not exists (
    select 1 from public.menu_items item
    join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
    where item.restaurant_id = p_restaurant_id and item.is_visible and category.is_visible
      and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
  ) then raise exception using errcode = 'P0001', message = 'published_menu_empty'; end if;

  return pg_catalog.jsonb_build_object('ok', true, 'itemId', item_id_value, 'removedPaths', removed_paths);
end;
$function$;

create or replace function public.reorder_menu_categories(p_restaurant_id uuid, p_order uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare category_count integer;
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select count(*) into category_count from public.menu_categories where restaurant_id = p_restaurant_id;
  if coalesce(cardinality(p_order), 0) <> category_count
    or (select count(distinct ordered.id) from pg_catalog.unnest(p_order) as ordered(id)) <> category_count
    or exists (select 1 from pg_catalog.unnest(p_order) as ordered(id) where not exists (select 1 from public.menu_categories where id = ordered.id and restaurant_id = p_restaurant_id)) then
    raise exception using errcode = '22023', message = 'menu_invalid_order';
  end if;
  update public.menu_categories category set position = ordered.ordinality::integer - 1
  from pg_catalog.unnest(p_order) with ordinality as ordered(id, ordinality)
  where category.id = ordered.id and category.restaurant_id = p_restaurant_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.reorder_menu_items(p_restaurant_id uuid, p_category_id uuid, p_order uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare item_count integer;
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select count(*) into item_count from public.menu_items where restaurant_id = p_restaurant_id and category_id = p_category_id;
  if coalesce(cardinality(p_order), 0) <> item_count
    or (select count(distinct ordered.id) from pg_catalog.unnest(p_order) as ordered(id)) <> item_count
    or exists (select 1 from pg_catalog.unnest(p_order) as ordered(id) where not exists (
      select 1 from public.menu_items where id = ordered.id and restaurant_id = p_restaurant_id and category_id = p_category_id
    )) then raise exception using errcode = '22023', message = 'menu_invalid_order'; end if;
  update public.menu_items item set position = ordered.ordinality::integer - 1
  from pg_catalog.unnest(p_order) with ordinality as ordered(id, ordinality)
  where item.id = ordered.id and item.restaurant_id = p_restaurant_id and item.category_id = p_category_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.move_menu_item(p_restaurant_id uuid, p_item_id uuid, p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare current_category_id uuid; menu_is_published boolean;
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select menu_status = 'published' into menu_is_published from public.restaurants where id = p_restaurant_id;
  select category_id into current_category_id from public.menu_items where id = p_item_id and restaurant_id = p_restaurant_id for update;
  if current_category_id is null then raise exception using errcode = 'P0002', message = 'menu_item_not_found'; end if;
  if not exists (select 1 from public.menu_categories where id = p_category_id and restaurant_id = p_restaurant_id) then
    raise exception using errcode = 'P0002', message = 'menu_category_not_found';
  end if;
  if menu_is_published and exists (
    select 1 from public.menu_items item
    join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
    where item.id = p_item_id and item.is_visible and category.is_visible
      and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
  ) and not exists (
    select 1 from public.menu_items item
    join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
    where item.restaurant_id = p_restaurant_id and item.id <> p_item_id and item.is_visible and category.is_visible
      and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
  ) and not exists (select 1 from public.menu_categories where id = p_category_id and is_visible) then
    raise exception using errcode = 'P0001', message = 'published_menu_empty';
  end if;
  update public.menu_items set category_id = p_category_id,
    position = coalesce((select max(position) + 1 from public.menu_items where category_id = p_category_id and restaurant_id = p_restaurant_id), 0)
  where id = p_item_id and restaurant_id = p_restaurant_id;
  return pg_catalog.jsonb_build_object('ok', true, 'categoryId', p_category_id);
end;
$function$;

create or replace function public.set_menu_visibility(p_restaurant_id uuid, p_kind text, p_id uuid, p_is_visible boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare menu_is_published boolean; record_exists boolean;
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  if p_kind not in ('category', 'item') then raise exception using errcode = '22023', message = 'menu_invalid_target'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select menu_status = 'published' into menu_is_published from public.restaurants where id = p_restaurant_id;
  if p_kind = 'category' then
    select exists (select 1 from public.menu_categories where id = p_id and restaurant_id = p_restaurant_id) into record_exists;
    if not record_exists then raise exception using errcode = 'P0002', message = 'menu_category_not_found'; end if;
    if menu_is_published and not p_is_visible and not exists (
      select 1 from public.menu_items item join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
      where item.restaurant_id = p_restaurant_id and item.is_visible and category.is_visible and category.id <> p_id
        and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
    ) then raise exception using errcode = 'P0001', message = 'published_menu_empty'; end if;
    update public.menu_categories set is_visible = p_is_visible where id = p_id and restaurant_id = p_restaurant_id;
  else
    select exists (select 1 from public.menu_items where id = p_id and restaurant_id = p_restaurant_id) into record_exists;
    if not record_exists then raise exception using errcode = 'P0002', message = 'menu_item_not_found'; end if;
    if menu_is_published and not p_is_visible and exists (
      select 1 from public.menu_items item join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
      where item.id = p_id and item.is_visible and category.is_visible
        and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
    ) and not exists (
      select 1 from public.menu_items item join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
      where item.restaurant_id = p_restaurant_id and item.id <> p_id and item.is_visible and category.is_visible
        and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
    ) then raise exception using errcode = 'P0001', message = 'published_menu_empty'; end if;
    update public.menu_items set is_visible = p_is_visible where id = p_id and restaurant_id = p_restaurant_id;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'isVisible', p_is_visible);
end;
$function$;

create or replace function public.set_menu_item_availability(p_restaurant_id uuid, p_item_id uuid, p_is_available boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  update public.menu_items set is_available = p_is_available where id = p_item_id and restaurant_id = p_restaurant_id;
  if not found then raise exception using errcode = 'P0002', message = 'menu_item_not_found'; end if;
  return pg_catalog.jsonb_build_object('ok', true, 'isAvailable', p_is_available);
end;
$function$;

create or replace function public.delete_menu_item(p_restaurant_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare menu_is_published boolean; removed_paths jsonb;
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select menu_status = 'published' into menu_is_published from public.restaurants where id = p_restaurant_id;
  if not exists (select 1 from public.menu_items where id = p_item_id and restaurant_id = p_restaurant_id) then raise exception using errcode = 'P0002', message = 'menu_item_not_found'; end if;
  if menu_is_published and exists (
    select 1 from public.menu_items item join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
    where item.id = p_item_id and item.is_visible and category.is_visible
      and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
  ) and not exists (
    select 1 from public.menu_items item join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
    where item.restaurant_id = p_restaurant_id and item.id <> p_item_id and item.is_visible and category.is_visible
      and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id)
  ) then raise exception using errcode = 'P0001', message = 'published_menu_empty'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('bucket', files.bucket_id, 'path', files.path)), '[]'::jsonb)
  into removed_paths from (
    select case when media.kind = 'image' then 'menu-images' else 'menu-videos' end as bucket_id, media.storage_path as path
    from public.menu_item_media media where media.item_id = p_item_id and media.restaurant_id = p_restaurant_id
    union all
    select 'menu-images', media.poster_path from public.menu_item_media media
    where media.item_id = p_item_id and media.restaurant_id = p_restaurant_id and media.poster_path is not null
  ) as files;
  delete from public.menu_items where id = p_item_id and restaurant_id = p_restaurant_id;
  return pg_catalog.jsonb_build_object('ok', true, 'removedPaths', coalesce(removed_paths, '[]'::jsonb));
end;
$function$;

create or replace function public.delete_menu_category(p_restaurant_id uuid, p_category_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not exists (select 1 from public.menu_categories where id = p_category_id and restaurant_id = p_restaurant_id) then raise exception using errcode = 'P0002', message = 'menu_category_not_found'; end if;
  if exists (select 1 from public.menu_items where category_id = p_category_id and restaurant_id = p_restaurant_id) then
    raise exception using errcode = 'P0001', message = 'menu_category_not_empty';
  end if;
  delete from public.menu_categories where id = p_category_id and restaurant_id = p_restaurant_id;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.publish_menu(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare effective_count integer;
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  select count(*) into effective_count
  from public.menu_items item join public.menu_categories category on category.id = item.category_id and category.restaurant_id = item.restaurant_id
  where item.restaurant_id = p_restaurant_id and item.is_visible and category.is_visible
    and exists (select 1 from public.menu_item_media media where media.item_id = item.id and media.restaurant_id = item.restaurant_id);
  if effective_count < 1 then raise exception using errcode = 'P0001', message = 'menu_requires_public_item'; end if;
  update public.restaurants set menu_status = 'published' where id = p_restaurant_id;
  return pg_catalog.jsonb_build_object('ok', true, 'menuStatus', 'published', 'effectiveCount', effective_count);
end;
$function$;

create or replace function public.unpublish_menu(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.panel_menu_member(p_restaurant_id) then raise exception using errcode = '42501', message = 'menu_unauthorized'; end if;
  update public.restaurants set menu_status = 'draft' where id = p_restaurant_id;
  return pg_catalog.jsonb_build_object('ok', true, 'menuStatus', 'draft');
end;
$function$;

revoke all on function public.save_menu_category(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.save_menu_attribute(uuid, text, text) from public, anon, authenticated;
revoke all on function public.save_menu_item(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.reorder_menu_categories(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.reorder_menu_items(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.move_menu_item(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_menu_visibility(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.set_menu_item_availability(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_menu_item(uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_menu_category(uuid, uuid) from public, anon, authenticated;
revoke all on function public.publish_menu(uuid) from public, anon, authenticated;
revoke all on function public.unpublish_menu(uuid) from public, anon, authenticated;

grant execute on function public.save_menu_category(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.save_menu_attribute(uuid, text, text) to authenticated;
grant execute on function public.save_menu_item(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.reorder_menu_categories(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_menu_items(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.move_menu_item(uuid, uuid, uuid) to authenticated;
grant execute on function public.set_menu_visibility(uuid, text, uuid, boolean) to authenticated;
grant execute on function public.set_menu_item_availability(uuid, uuid, boolean) to authenticated;
grant execute on function public.delete_menu_item(uuid, uuid) to authenticated;
grant execute on function public.delete_menu_category(uuid, uuid) to authenticated;
grant execute on function public.publish_menu(uuid) to authenticated;
grant execute on function public.unpublish_menu(uuid) to authenticated;
