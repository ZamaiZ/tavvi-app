-- Replace the initial RPC implementation for databases that already applied
-- the invites migration, without rebuilding their data.
create or replace function public.list_platform_invites(
  p_search text default '',
  p_status text default 'all',
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_search text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_search, '')));
  escaped_search text;
  normalized_status text := coalesce(p_status, 'all');
  requested_page integer := coalesce(p_page, 1);
  requested_page_size integer := coalesce(p_page_size, 25);
  result jsonb;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;

  if pg_catalog.char_length(normalized_search) > 254
    or normalized_status not in ('all', 'pending', 'redeemed', 'expired', 'revoked')
    or requested_page < 1 or requested_page > 1000000
    or requested_page_size < 1 or requested_page_size > 100 then
    raise exception using errcode = '22023', message = 'invalid_invite_query';
  end if;

  escaped_search := pg_catalog.replace(
    pg_catalog.replace(
      pg_catalog.replace(normalized_search, E'\\', E'\\\\'),
      '%', E'\\%'
    ),
    '_', E'\\_'
  );

  with base as not materialized (
    select
      invite.id,
      invite.email,
      invite.created_at,
      invite.expires_at,
      invite.redeemed_at,
      invite.redeemed_by,
      invite.restaurant_id,
      invite.revoked_at,
      restaurant.name as restaurant_name,
      case
        when invite.revoked_at is not null then 'revoked'
        when invite.redeemed_at is not null then 'redeemed'
        when invite.expires_at <= pg_catalog.statement_timestamp() then 'expired'
        else 'pending'
      end as status
    from public.platform_invites as invite
    left join public.restaurants as restaurant on restaurant.id = invite.restaurant_id
  ), filtered as not materialized (
    select *
    from base
    where (normalized_status = 'all' or status = normalized_status)
      and (
        normalized_search = ''
        or (
          email is not null
          and pg_catalog.lower(email) like escaped_search || '%' escape E'\\'
        )
      )
  ), totals as (
    select
      pg_catalog.count(*)::integer as total_rows,
      pg_catalog.count(*) filter (where status = 'pending')::integer as pending_count,
      pg_catalog.count(*) filter (where status = 'redeemed')::integer as redeemed_count,
      pg_catalog.count(*) filter (where status = 'expired')::integer as expired_count,
      pg_catalog.count(*) filter (where status = 'revoked')::integer as revoked_count
    from base
  ), filtered_total as (
    select pg_catalog.count(*)::integer as total_rows from filtered
  ), pagination as (
    select
      case
        when filtered_total.total_rows = 0 then 1
        else least(
          requested_page,
          pg_catalog.ceil(filtered_total.total_rows::numeric / requested_page_size)::integer
        )
      end as effective_page,
      filtered_total.total_rows
    from filtered_total
  ), ranked as (
    select
      filtered.*,
      pg_catalog.row_number() over (
        order by filtered.created_at desc, filtered.id desc
      ) as pagination_row
    from filtered
  ), paged as (
    select ranked.*
    from ranked
    cross join pagination
    where ranked.pagination_row >
      (pagination.effective_page - 1) * requested_page_size
      and ranked.pagination_row <= pagination.effective_page * requested_page_size
  )
  select pg_catalog.jsonb_build_object(
    'rows', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', id,
          'email', email,
          'status', status,
          'createdAt', created_at,
          'expiresAt', expires_at,
          'redeemedAt', redeemed_at,
          'redeemedBy', redeemed_by,
          'restaurantId', restaurant_id,
          'restaurantName', restaurant_name,
          'revokedAt', revoked_at
        ) order by created_at desc, id desc
      ) from paged
    ), '[]'::jsonb),
    'counts', pg_catalog.jsonb_build_object(
      'all', totals.total_rows,
      'pending', totals.pending_count,
      'redeemed', totals.redeemed_count,
      'expired', totals.expired_count,
      'revoked', totals.revoked_count
    ),
    'totalRows', pagination.total_rows,
    'page', pagination.effective_page,
    'pageSize', requested_page_size
  )
  into result
  from totals
  cross join pagination;

  return result;
end;
$function$;
