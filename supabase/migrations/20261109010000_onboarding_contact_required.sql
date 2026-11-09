-- Preserve draft validation; enforce the new requirements only at activation.
alter function public.panel_onboarding_profile_is_valid(jsonb, boolean)
  rename to panel_onboarding_profile_is_valid_base;

create or replace function public.panel_onboarding_profile_is_valid_base(
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
      and (p_profile -> 'contact' ->> 'googleReviewUrl') !~* '^https://search\.google\.com/local/writereview\?placeid=[A-Za-z0-9_-]{10,255}[A-Za-z0-9_-]{0,45}$'
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
      or (address_value ->> 'state') !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'
      or pg_catalog.char_length(address_value ->> 'street') < 2
      or pg_catalog.char_length(address_value ->> 'district') < 2
      or pg_catalog.char_length(address_value ->> 'city') < 2 then
      return false;
    end if;
  end if;

  return true;
end;
$function$;

create function public.panel_onboarding_profile_is_valid(p_profile jsonb, p_complete boolean)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(public.panel_onboarding_profile_is_valid_base(p_profile, p_complete)
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
    ), false);
$function$;

revoke all on function public.panel_onboarding_profile_is_valid(jsonb, boolean) from public, anon, authenticated;

