-- Distingue colisão de nome e de slug no retorno da prévia.

create or replace function public.check_platform_invite_restaurant_name(
  p_token_hash_hex text,
  p_restaurant_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invite public.platform_invites%rowtype;
  normalized_name text := pg_catalog.btrim(coalesce(p_restaurant_name, ''));
  normalized_slug text;
  name_taken boolean;
  slug_taken boolean;
begin
  if p_token_hash_hex is null or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or pg_catalog.char_length(normalized_name) not between 2 and 120 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select stored_invite.* into invite
  from public.platform_invites as stored_invite
  where stored_invite.token_hash = pg_catalog.decode(p_token_hash_hex, 'hex');

  if not found or invite.revoked_at is not null or invite.redeemed_at is not null
    or invite.expires_at <= pg_catalog.statement_timestamp() then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  if not public.consume_platform_invite_rate_limit('preview', invite.id, null) then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  normalized_slug := public.platform_restaurant_slug(normalized_name);
  select exists (
    select 1
    from public.restaurants as restaurant
    where pg_catalog.lower(pg_catalog.btrim(restaurant.name))
        = pg_catalog.lower(normalized_name)
  ) into name_taken;
  select exists (
    select 1
    from public.restaurants as restaurant
    where restaurant.slug = normalized_slug
  ) into slug_taken;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'available', not name_taken and not slug_taken,
    'nameAvailable', not name_taken,
    'slugAvailable', not slug_taken,
    'slug', normalized_slug
  );
end;
$function$;

comment on function public.check_platform_invite_restaurant_name(text, text) is
  'Confere nome e slug sugerida para convite válido sem reservar o nome nem revelar dados do restaurante.';
