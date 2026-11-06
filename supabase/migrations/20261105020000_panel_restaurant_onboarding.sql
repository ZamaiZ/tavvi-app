-- Perfil e transição atômica do onboarding do Painel.
-- Dados antigos continuam válidos e permanecem draft até o responsável concluir.

alter table public.restaurants
  add column description text not null default '',
  add column segment text,
  add column theme jsonb not null default '{"preset":"grao","base":null,"accent":null,"density":"confortavel"}'::jsonb,
  add column menu_presentation text not null default 'immersive',
  add column logo_path text,
  add column cover_path text,
  add column contact jsonb not null default '{}'::jsonb,
  add column onboarding_step text not null default 'identity';

alter table public.restaurants
  add constraint restaurants_description_length_check
    check (pg_catalog.char_length(description) <= 500),
  add constraint restaurants_segment_length_check
    check (segment is null or pg_catalog.char_length(segment) between 2 and 60),
  add constraint restaurants_theme_object_check
    check (pg_catalog.jsonb_typeof(theme) = 'object'),
  add constraint restaurants_menu_presentation_check
    check (menu_presentation in ('immersive', 'catalog-list', 'catalog-grid')),
  add constraint restaurants_contact_object_check
    check (pg_catalog.jsonb_typeof(contact) = 'object'),
  add constraint restaurants_onboarding_step_check
    check (onboarding_step in ('identity', 'contact'));

comment on column public.restaurants.onboarding_step is
  'Passo atual persistido do onboarding enquanto status=draft.';

create function public.panel_onboarding_profile_is_valid(
  p_profile jsonb,
  p_complete boolean
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  address_value jsonb;
  has_address boolean;
  address_key text;
  address_text text;
  required_address_keys text[] := array['cep', 'street', 'number', 'district', 'city', 'state'];
begin
  if p_profile is null
    or pg_catalog.jsonb_typeof(p_profile) is distinct from 'object'
    or not (p_profile ?& array['name', 'description', 'segment', 'theme', 'menuPresentation', 'logoPath', 'coverPath', 'contact'])
    or pg_catalog.jsonb_typeof(p_profile -> 'name') is distinct from 'string'
    or pg_catalog.char_length(pg_catalog.btrim(p_profile ->> 'name')) not between 2 and 120
    or pg_catalog.jsonb_typeof(p_profile -> 'description') is distinct from 'string'
    or pg_catalog.char_length(p_profile ->> 'description') > 500
    or (p_profile -> 'segment' is distinct from 'null'::jsonb and (
      pg_catalog.jsonb_typeof(p_profile -> 'segment') is distinct from 'string'
      or pg_catalog.char_length(pg_catalog.btrim(p_profile ->> 'segment')) not between 2 and 60
    ))
    or pg_catalog.jsonb_typeof(p_profile -> 'theme') is distinct from 'object'
    or not ((p_profile -> 'theme') ?& array['preset', 'base', 'accent', 'density'])
    or pg_catalog.jsonb_typeof(p_profile -> 'theme' -> 'preset') is distinct from 'string'
    or p_profile -> 'theme' ->> 'preset' not in (
      'brasa', 'forno', 'grao', 'sal', 'horta', 'neon', 'nori', 'confeito'
    )
    or pg_catalog.jsonb_typeof(p_profile -> 'theme' -> 'density') is distinct from 'string'
    or p_profile -> 'theme' ->> 'density' not in ('confortavel', 'compacto')
    or pg_catalog.jsonb_typeof(p_profile -> 'theme' -> 'base') not in ('string', 'null')
    or pg_catalog.jsonb_typeof(p_profile -> 'theme' -> 'accent') not in ('string', 'null')
    or (
      p_profile -> 'theme' -> 'base' is distinct from 'null'::jsonb
      and (p_profile -> 'theme' ->> 'base') !~* '^#[0-9a-f]{6}$'
    )
    or (
      p_profile -> 'theme' -> 'accent' is distinct from 'null'::jsonb
      and (p_profile -> 'theme' ->> 'accent') !~* '^#[0-9a-f]{6}$'
    )
    or pg_catalog.jsonb_typeof(p_profile -> 'menuPresentation') is distinct from 'string'
    or p_profile ->> 'menuPresentation' not in ('immersive', 'catalog-list', 'catalog-grid')
    or pg_catalog.jsonb_typeof(p_profile -> 'logoPath') not in ('string', 'null')
    or pg_catalog.jsonb_typeof(p_profile -> 'coverPath') not in ('string', 'null')
    or pg_catalog.jsonb_typeof(p_profile -> 'contact') is distinct from 'object'
    or not ((p_profile -> 'contact') ?& array['phone', 'whatsapp', 'instagram', 'address', 'mapsUrl', 'googleReviewUrl'])
    or pg_catalog.jsonb_typeof(p_profile -> 'contact' -> 'phone') is distinct from 'string'
    or pg_catalog.char_length(p_profile -> 'contact' ->> 'phone') > 30
    or (p_complete and p_profile -> 'contact' ->> 'phone' <> '' and (p_profile -> 'contact' ->> 'phone') !~ '^\+?[0-9 () .-]{8,24}$')
    or pg_catalog.jsonb_typeof(p_profile -> 'contact' -> 'whatsapp') is distinct from 'string'
    or pg_catalog.char_length(p_profile -> 'contact' ->> 'whatsapp') > 30
    or (p_complete and p_profile -> 'contact' ->> 'whatsapp' <> '' and (p_profile -> 'contact' ->> 'whatsapp') !~ '^\+?[0-9 () .-]{8,24}$')
    or pg_catalog.jsonb_typeof(p_profile -> 'contact' -> 'instagram') is distinct from 'string'
    or pg_catalog.char_length(p_profile -> 'contact' ->> 'instagram') > 60
    or (p_complete and p_profile -> 'contact' ->> 'instagram' <> '' and (p_profile -> 'contact' ->> 'instagram') !~ '^@?[A-Za-z0-9._]{1,60}$')
    or pg_catalog.jsonb_typeof(p_profile -> 'contact' -> 'mapsUrl') is distinct from 'string'
    or pg_catalog.char_length(p_profile -> 'contact' ->> 'mapsUrl') > 500
    or (p_complete and p_profile -> 'contact' ->> 'mapsUrl' <> '' and (
      (p_profile -> 'contact' ->> 'mapsUrl') !~* '^https://(maps\.app\.goo\.gl|g\.page|maps\.google\.com(\.br)?)(/|[?#]|$)'
      and (p_profile -> 'contact' ->> 'mapsUrl') !~* '^https://(www\.)?google\.com(\.br)?/maps(/|[?#]|$)'
      and (p_profile -> 'contact' ->> 'mapsUrl') !~* '^https://goo\.gl/maps(/|[?#]|$)'
    ))
    or pg_catalog.jsonb_typeof(p_profile -> 'contact' -> 'googleReviewUrl') is distinct from 'string'
    or pg_catalog.char_length(p_profile -> 'contact' ->> 'googleReviewUrl') > 400
    or (p_complete and p_profile -> 'contact' ->> 'googleReviewUrl' <> '' and (
      (p_profile -> 'contact' ->> 'googleReviewUrl') !~* '^https://g\.page/r/[A-Za-z0-9_-]+/review$'
      and (p_profile -> 'contact' ->> 'googleReviewUrl') !~* '^https://search\.google\.com/local/writereview\?placeid=[A-Za-z0-9_-]{10,300}$'
    ))
    or pg_catalog.jsonb_typeof(p_profile -> 'contact' -> 'address') is distinct from 'object'
  then
    return false;
  end if;

  address_value := p_profile -> 'contact' -> 'address';
  if (address_value - array['cep', 'street', 'number', 'complement', 'district', 'city', 'state']) <> '{}'::jsonb then
    return false;
  end if;
  has_address := false;
  for address_key in select pg_catalog.jsonb_object_keys(address_value) loop
    address_text := address_value ->> address_key;
    if pg_catalog.jsonb_typeof(address_value -> address_key) is distinct from 'string'
      or address_text is null
      or (address_key = 'cep' and pg_catalog.char_length(address_text) > 9)
      or (address_key = 'street' and pg_catalog.char_length(address_text) > 120)
      or (address_key = 'number' and pg_catalog.char_length(address_text) > 10)
      or (address_key = 'complement' and pg_catalog.char_length(address_text) > 60)
      or (address_key = 'district' and pg_catalog.char_length(address_text) > 80)
      or (address_key = 'city' and pg_catalog.char_length(address_text) > 80)
      or (address_key = 'state' and pg_catalog.char_length(address_text) > 2) then
      return false;
    end if;
    if address_text <> '' then has_address := true; end if;
  end loop;

  if p_complete and has_address then
    foreach address_key in array required_address_keys loop
      address_text := pg_catalog.btrim(coalesce(address_value ->> address_key, ''));
      if address_text = '' then return false; end if;
    end loop;
    if (address_value ->> 'cep') !~ '^[0-9]{5}-?[0-9]{3}$'
      or (address_value ->> 'state') !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'
      or pg_catalog.char_length(address_value ->> 'street') < 2
      or pg_catalog.char_length(address_value ->> 'district') < 2
      or pg_catalog.char_length(address_value ->> 'city') < 2 then
      return false;
    end if;
  end if;

  return true;
end;
$function$;

create function public.save_panel_restaurant_draft(
  p_restaurant_id uuid,
  p_step text,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  restaurant_row public.restaurants%rowtype;
  actor_id uuid := auth.uid();
  logo_path_value text := nullif(p_profile ->> 'logoPath', '');
  cover_path_value text := nullif(p_profile ->> 'coverPath', '');
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if p_step is null or p_step not in ('identity', 'contact')
    or not public.panel_onboarding_profile_is_valid(p_profile, false)
    or (logo_path_value is not null and (
      logo_path_value !~ ('^' || p_restaurant_id::text || '/logo/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$')
    ))
    or (cover_path_value is not null and (
      cover_path_value !~ ('^' || p_restaurant_id::text || '/cover/[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$')
    )) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select restaurant.* into restaurant_row
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
    and restaurant.status = 'draft'
    and exists (
      select 1 from public.memberships as membership
      where membership.restaurant_id = restaurant.id
        and membership.user_id = actor_id
        and membership.status = 'active'
    )
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update public.restaurants as restaurant
  set name = pg_catalog.btrim(p_profile ->> 'name'),
      description = p_profile ->> 'description',
      segment = nullif(p_profile ->> 'segment', ''),
      theme = p_profile -> 'theme',
      menu_presentation = p_profile ->> 'menuPresentation',
      logo_path = logo_path_value,
      cover_path = cover_path_value,
      contact = p_profile -> 'contact',
      onboarding_step = p_step
  where restaurant.id = p_restaurant_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'restaurantId', p_restaurant_id,
    'status', 'draft'
  );
end;
$function$;

create function public.complete_panel_restaurant_onboarding(
  p_restaurant_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  saved jsonb;
begin
  if actor_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  if not public.panel_onboarding_profile_is_valid(p_profile, true) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  saved := public.save_panel_restaurant_draft(p_restaurant_id, 'contact', p_profile);
  if coalesce((saved ->> 'ok')::boolean, false) is not true then
    return saved;
  end if;

  update public.restaurants as restaurant
  set status = 'active', onboarding_step = 'contact'
  where restaurant.id = p_restaurant_id
    and restaurant.status = 'draft'
    and exists (
      select 1 from public.memberships as membership
      where membership.restaurant_id = restaurant.id
        and membership.user_id = actor_id
        and membership.status = 'active'
    );

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'restaurantId', p_restaurant_id,
    'status', 'active'
  );
end;
$function$;

revoke all on function public.panel_onboarding_profile_is_valid(jsonb, boolean) from PUBLIC, anon, authenticated;
revoke all on function public.save_panel_restaurant_draft(uuid, text, jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.complete_panel_restaurant_onboarding(uuid, jsonb) from PUBLIC, anon, authenticated;
grant execute on function public.save_panel_restaurant_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.complete_panel_restaurant_onboarding(uuid, jsonb) to authenticated;
