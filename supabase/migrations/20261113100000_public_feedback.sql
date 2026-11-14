-- Feedback anônimo do cardápio público.
-- A APP_SERVER_KEY é configurada no servidor Next e, uma vez, no SQL Editor:
-- select public.set_app_server_key('<a mesma chave server-only>');
-- O banco guarda somente o SHA-256 da chave.

create table if not exists public.app_server_keys (
  name text primary key check (char_length(name) between 1 and 40),
  key_hash bytea not null,
  updated_at timestamptz not null default now()
);

alter table public.app_server_keys enable row level security;
revoke all on public.app_server_keys from public, anon, authenticated;

create or replace function public.set_app_server_key(p_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if p_key is null or pg_catalog.char_length(p_key) < 32 then
    raise exception 'feedback_server_key_invalid';
  end if;

  insert into public.app_server_keys (name, key_hash, updated_at)
  values ('server', pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8')), now())
  on conflict (name) do update
    set key_hash = excluded.key_hash, updated_at = now();
end;
$function$;

revoke all on function public.set_app_server_key(text) from public, anon, authenticated;

create or replace function public.check_app_server_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_key is not null and exists (
    select 1
      from public.app_server_keys as server_key
     where server_key.name = 'server'
       and server_key.key_hash = pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8'))
  );
$function$;

revoke all on function public.check_app_server_key(text) from public, anon, authenticated;

create table if not exists public.restaurant_feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 3 and 1000),
  status text not null default 'draft' check (status in ('draft', 'published', 'deleted')),
  created_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  unique (id, restaurant_id),
  constraint restaurant_feedback_publication_state_check check (
    (status = 'draft' and published_at is null and deleted_at is null)
    or (status = 'published' and published_at is not null and deleted_at is null)
    or (status = 'deleted' and published_at is not null and deleted_at is not null)
  )
);

create table if not exists public.restaurant_feedback_media (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null,
  restaurant_id uuid not null,
  kind text not null check (kind in ('image', 'video')),
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  storage_path text not null unique,
  width integer not null,
  height integer not null,
  duration_ms integer,
  position smallint not null check (position between 0 and 2),
  created_at timestamptz not null default statement_timestamp(),
  constraint restaurant_feedback_media_feedback_same_restaurant
    foreign key (feedback_id, restaurant_id)
    references public.restaurant_feedback (id, restaurant_id) on delete cascade,
  constraint restaurant_feedback_media_position_key unique (feedback_id, position),
  constraint restaurant_feedback_media_path_check check (
    storage_path ~ (
      '^' || restaurant_id::text || '/' || feedback_id::text ||
      '/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif|mp4|webm)$'
    )
  ),
  constraint restaurant_feedback_media_type_check check (
    (
      kind = 'image'
      and mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
      and byte_size between 1 and 5242880
      and width between 1 and 1920
      and height between 1 and 1920
      and duration_ms is null
      and storage_path ~ '[.](jpg|jpeg|png|webp|avif)$'
    )
    or (
      kind = 'video'
      and mime_type in ('video/mp4', 'video/webm')
      and byte_size between 1 and 10485760
      and width between 1 and 10000
      and height between 1 and 10000
      and duration_ms is not null
      and duration_ms between 1 and 15000
      and storage_path ~ '[.](mp4|webm)$'
    )
  )
);

create index if not exists restaurant_feedback_published_idx
  on public.restaurant_feedback (restaurant_id, published_at desc, id desc)
  where status = 'published';

create index if not exists restaurant_feedback_unread_idx
  on public.restaurant_feedback (restaurant_id, published_at desc, id desc)
  where status = 'published' and read_at is null;

create index if not exists restaurant_feedback_quota_idx
  on public.restaurant_feedback (restaurant_id, created_at);

create index if not exists restaurant_feedback_cleanup_idx
  on public.restaurant_feedback (restaurant_id, created_at, id)
  where status in ('draft', 'deleted');

create index if not exists restaurant_feedback_media_order_idx
  on public.restaurant_feedback_media (feedback_id, position, id);

alter table public.restaurant_feedback enable row level security;
alter table public.restaurant_feedback_media enable row level security;
revoke all on public.restaurant_feedback from public, anon, authenticated;
revoke all on public.restaurant_feedback_media from public, anon, authenticated;
grant select on public.restaurant_feedback to authenticated;
grant update (read_at) on public.restaurant_feedback to authenticated;
grant select on public.restaurant_feedback_media to authenticated;

drop policy if exists restaurant_feedback_select_member on public.restaurant_feedback;
create policy restaurant_feedback_select_member on public.restaurant_feedback
for select to authenticated
using (public.panel_menu_member(restaurant_id) and status = 'published');

drop policy if exists restaurant_feedback_update_member on public.restaurant_feedback;
create policy restaurant_feedback_update_member on public.restaurant_feedback
for update to authenticated
using (public.panel_menu_member(restaurant_id) and status = 'published')
with check (public.panel_menu_member(restaurant_id) and status = 'published');

drop policy if exists restaurant_feedback_delete_member on public.restaurant_feedback;

drop policy if exists restaurant_feedback_media_select_member on public.restaurant_feedback_media;
create policy restaurant_feedback_media_select_member on public.restaurant_feedback_media
for select to authenticated
using (
  public.panel_menu_member(restaurant_id)
  and exists (
    select 1
      from public.restaurant_feedback as feedback
     where feedback.id = restaurant_feedback_media.feedback_id
       and feedback.restaurant_id = restaurant_feedback_media.restaurant_id
       and feedback.status = 'published'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('feedback-images', 'feedback-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]),
  ('feedback-videos', 'feedback-videos', false, 10485760, array['video/mp4', 'video/webm']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.feedback_upload_allowed(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(exists (
    select 1
      from public.restaurant_feedback_media as media
      join public.restaurant_feedback as feedback
        on feedback.id = media.feedback_id and feedback.restaurant_id = media.restaurant_id
      join public.restaurants as restaurant on restaurant.id = media.restaurant_id
     where media.storage_path = p_object_name
       and feedback.status = 'draft'
       and feedback.created_at > now() - interval '15 minutes'
       and restaurant.status = 'active'
  ), false);
$function$;

revoke all on function public.feedback_upload_allowed(text) from public, authenticated;
grant execute on function public.feedback_upload_allowed(text) to anon, authenticated;

create or replace function public.feedback_storage_member(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif|mp4|webm)$'
    and exists (
      select 1
        from public.restaurant_feedback_media as media
        join public.restaurant_feedback as feedback
          on feedback.id = media.feedback_id and feedback.restaurant_id = media.restaurant_id
       where media.storage_path = p_object_name
         and feedback.status = 'published'
         and public.panel_menu_member(media.restaurant_id)
    ),
    false
  );
$function$;

revoke all on function public.feedback_storage_member(text) from public, anon, authenticated;
grant execute on function public.feedback_storage_member(text) to authenticated;

create or replace function public.feedback_storage_delete_member(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|jpeg|png|webp|avif|mp4|webm)$'
    and exists (
      select 1
        from public.restaurant_feedback_media as media
        join public.restaurant_feedback as feedback
          on feedback.id = media.feedback_id and feedback.restaurant_id = media.restaurant_id
       where media.storage_path = p_object_name
         and public.panel_menu_member(media.restaurant_id)
         and (
           feedback.status = 'deleted'
           or (
             feedback.status = 'draft'
             and feedback.created_at < now() - interval '2 hours 16 minutes'
           )
         )
    ),
    false
  );
$function$;

revoke all on function public.feedback_storage_delete_member(text) from public, anon, authenticated;
grant execute on function public.feedback_storage_delete_member(text) to authenticated;

drop policy if exists feedback_storage_anonymous_insert on storage.objects;
create policy feedback_storage_anonymous_insert on storage.objects
for insert to anon, authenticated
with check (
  bucket_id in ('feedback-images', 'feedback-videos')
  and public.feedback_upload_allowed(name)
  and (
    (bucket_id = 'feedback-images' and name ~ '[.](jpg|jpeg|png|webp|avif)$')
    or (bucket_id = 'feedback-videos' and name ~ '[.](mp4|webm)$')
  )
);

drop policy if exists feedback_storage_member_select on storage.objects;
create policy feedback_storage_member_select on storage.objects
for select to authenticated
using (
  bucket_id in ('feedback-images', 'feedback-videos')
  and public.feedback_storage_member(name)
);

drop policy if exists feedback_storage_member_delete on storage.objects;
create policy feedback_storage_member_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('feedback-images', 'feedback-videos')
  and public.feedback_storage_delete_member(name)
);

create table if not exists public.feedback_rate_limits (
  bucket text not null check (bucket in ('feedback:start', 'feedback:publish')),
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (bucket, identity_hash)
);

create index if not exists feedback_rate_limits_expiry_idx
  on public.feedback_rate_limits (expires_at);

alter table public.feedback_rate_limits enable row level security;
revoke all on public.feedback_rate_limits from public, anon, authenticated;

create or replace function public.check_feedback_rate_limit(
  p_key text,
  p_bucket text,
  p_identity_hash text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  attempts_value integer;
  now_value timestamptz := statement_timestamp();
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;

  if p_bucket is null or p_identity_hash is null or p_max is null or p_window_seconds is null
     or p_bucket not in ('feedback:start', 'feedback:publish')
     or p_identity_hash !~ '^[0-9a-f]{64}$'
     or p_max not between 1 and 10
     or p_window_seconds not between 60 and 600 then
    raise exception 'feedback_rate_limit_invalid' using errcode = '22023';
  end if;

  delete from public.feedback_rate_limits as expired
   where expired.expires_at <= now_value;

  insert into public.feedback_rate_limits as current_limit (bucket, identity_hash, window_started_at, attempts, expires_at)
  values (p_bucket, p_identity_hash, now_value, 1, now_value + pg_catalog.make_interval(secs => p_window_seconds))
  on conflict (bucket, identity_hash) do update set
    window_started_at = case
      when current_limit.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= now_value
        then now_value
      else current_limit.window_started_at
    end,
    attempts = case
      when current_limit.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= now_value
        then 1
      else current_limit.attempts + 1
    end,
    expires_at = now_value + pg_catalog.make_interval(secs => p_window_seconds)
  returning attempts into attempts_value;

  return attempts_value <= p_max;
end;
$function$;

revoke all on function public.check_feedback_rate_limit(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_feedback_rate_limit(text, text, text, integer, integer) to anon, authenticated;

create or replace function public.begin_feedback(
  p_key text,
  p_slug text,
  p_body text,
  p_media jsonb
)
returns table(feedback_id uuid, storage_path text, bucket_id text, media_position smallint)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  restaurant_id_value uuid;
  feedback_id_value uuid;
  media_value jsonb;
  media_position_value smallint := 0;
  kind_value text;
  mime_value text;
  extension_value text;
  byte_size_value integer;
  width_value integer;
  height_value integer;
  duration_value integer;
  path_value text;
  bucket_value text;
  count_value integer;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;

  select restaurant.id into restaurant_id_value
    from public.restaurants as restaurant
   where restaurant.slug = p_slug
     and restaurant.status = 'active';

  if restaurant_id_value is null then
    raise exception 'feedback_unavailable';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_body, ''))) not between 3 and 1000 then
    raise exception 'feedback_invalid' using detail = 'texto';
  end if;

  if p_media is null or pg_catalog.jsonb_typeof(p_media) <> 'array' then
    raise exception 'feedback_invalid' using detail = 'midias';
  end if;

  if pg_catalog.jsonb_array_length(p_media) > 3 then
    raise exception 'feedback_invalid' using detail = 'midias';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(restaurant_id_value::text, 0));

  select count(*) into count_value
    from public.restaurant_feedback as feedback
   where feedback.restaurant_id = restaurant_id_value
     and feedback.created_at > now() - interval '1 hour';

  if count_value >= 30 then
    raise exception 'feedback_capped';
  end if;

  select count(*) into count_value
    from public.restaurant_feedback as feedback
   where feedback.restaurant_id = restaurant_id_value
     and feedback.created_at > now() - interval '24 hours';

  if count_value >= 200 then
    raise exception 'feedback_capped';
  end if;

  insert into public.restaurant_feedback (restaurant_id, body)
  values (restaurant_id_value, pg_catalog.btrim(p_body))
  returning id into feedback_id_value;

  for media_value in
    select entry.value
      from pg_catalog.jsonb_array_elements(p_media) with ordinality as entry(value, ordinal)
     order by entry.ordinal
  loop
    begin
      kind_value := media_value ->> 'kind';
      mime_value := media_value ->> 'mime';
      byte_size_value := (media_value ->> 'byteSize')::integer;
      width_value := (media_value ->> 'width')::integer;
      height_value := (media_value ->> 'height')::integer;
      duration_value := nullif(media_value ->> 'durationMs', '')::integer;
    exception when others then
      raise exception 'feedback_invalid' using detail = 'metadados';
    end;

    extension_value := case mime_value
      when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png'
      when 'image/webp' then 'webp'
      when 'image/avif' then 'avif'
      when 'video/mp4' then 'mp4'
      when 'video/webm' then 'webm'
      else null
    end;

    if kind_value is null or mime_value is null
       or extension_value is null
       or byte_size_value is null
       or width_value is null or width_value < 1 or width_value > 10000
       or height_value is null or height_value < 1 or height_value > 10000
       or (kind_value = 'image' and (
         mime_value not like 'image/%'
         or byte_size_value > 5242880
         or width_value > 1920 or height_value > 1920
         or duration_value is not null
       ))
       or (kind_value = 'video' and (
         mime_value not like 'video/%'
         or byte_size_value > 10485760
         or duration_value is null or duration_value not between 1 and 15000
       ))
       or kind_value not in ('image', 'video') then
      raise exception 'feedback_invalid' using detail = 'midia';
    end if;

    path_value := restaurant_id_value::text || '/' || feedback_id_value::text || '/' ||
      pg_catalog.gen_random_uuid()::text || '.' || extension_value;
    bucket_value := case when kind_value = 'image' then 'feedback-images' else 'feedback-videos' end;

    insert into public.restaurant_feedback_media (
      feedback_id, restaurant_id, kind, mime_type, byte_size,
      storage_path, width, height, duration_ms, position
    )
    values (
      feedback_id_value, restaurant_id_value, kind_value, mime_value, byte_size_value,
      path_value, width_value, height_value, duration_value, media_position_value
    );

    feedback_id := feedback_id_value;
    storage_path := path_value;
    bucket_id := bucket_value;
    media_position := media_position_value;
    return next;
    media_position_value := media_position_value + 1;
  end loop;

  if media_position_value = 0 then
    feedback_id := feedback_id_value;
    storage_path := null;
    bucket_id := null;
    media_position := null;
    return next;
  end if;
end;
$function$;

revoke all on function public.begin_feedback(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.begin_feedback(text, text, text, jsonb) to anon, authenticated;

create or replace function public.publish_feedback(p_key text, p_feedback_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  feedback_row public.restaurant_feedback%rowtype;
  missing_position smallint;
begin
  if not public.check_app_server_key(p_key) then
    raise exception 'server_key' using errcode = '42501';
  end if;

  select feedback.* into feedback_row
    from public.restaurant_feedback as feedback
   where feedback.id = p_feedback_id
   for update;

  if not found or feedback_row.status <> 'draft'
     or feedback_row.created_at <= now() - interval '2 hours 15 minutes' then
    raise exception 'feedback_expired';
  end if;

  select media.position into missing_position
    from public.restaurant_feedback_media as media
   where media.feedback_id = p_feedback_id
     and not exists (
       select 1
         from storage.objects as object
        where object.name = media.storage_path
          and object.bucket_id = case when media.kind = 'image' then 'feedback-images' else 'feedback-videos' end
     )
   order by media.position
   limit 1;

  if missing_position is not null then
    raise exception 'feedback_media_missing' using detail = (missing_position + 1)::text;
  end if;

  update public.restaurant_feedback as feedback
     set status = 'published', published_at = now()
   where feedback.id = p_feedback_id;
end;
$function$;

revoke all on function public.publish_feedback(text, uuid) from public, anon, authenticated;
grant execute on function public.publish_feedback(text, uuid) to anon, authenticated;

-- Hide feedback immediately but retain its storage paths until every upload
-- capability issued for its draft has expired, so a replay cannot leave an orphan.
create or replace function public.delete_feedback(p_restaurant_id uuid, p_feedback_id uuid)
returns table(feedback_id uuid, media_kind text, storage_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  feedback_id_value uuid;
begin
  if p_restaurant_id is null or p_feedback_id is null
     or not public.panel_menu_member(p_restaurant_id)
     or not exists (
       select 1
         from public.restaurants as restaurant
        where restaurant.id = p_restaurant_id
          and restaurant.status = 'active'
     ) then
    return;
  end if;

  update public.restaurant_feedback as feedback
     set status = 'deleted', deleted_at = statement_timestamp(), body = '[excluído]'
   where feedback.id = p_feedback_id
     and feedback.restaurant_id = p_restaurant_id
     and feedback.status = 'published'
  returning feedback.id into feedback_id_value;

  if feedback_id_value is null then
    return;
  end if;

  return query
  select feedback_id_value as feedback_id, media.kind as media_kind, media.storage_path as storage_path
    from (select 1) as marker
    left join public.restaurant_feedback_media as media
      on media.feedback_id = feedback_id_value
     and media.restaurant_id = p_restaurant_id;
end;
$function$;

revoke all on function public.delete_feedback(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_feedback(uuid, uuid) to authenticated;

-- Return at most 20 expired drafts/tombstones for Storage cleanup without
-- exposing their unpublished feedback bodies through ordinary table reads.
create or replace function public.feedback_cleanup_candidates(p_restaurant_id uuid)
returns table(feedback_id uuid, media_kind text, storage_path text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_restaurant_id is null
     or not public.panel_menu_member(p_restaurant_id)
     or not exists (
       select 1
         from public.restaurants as restaurant
        where restaurant.id = p_restaurant_id
          and restaurant.status = 'active'
     ) then
    return;
  end if;

  return query
  with candidates as (
    select feedback.id, feedback.created_at
      from public.restaurant_feedback as feedback
     where feedback.restaurant_id = p_restaurant_id
       and feedback.status in ('draft', 'deleted')
       and feedback.created_at < statement_timestamp() - interval '2 hours 16 minutes'
     order by feedback.created_at, feedback.id
     limit 20
  )
  select candidates.id as feedback_id, media.kind as media_kind, media.storage_path as storage_path
    from candidates
    left join public.restaurant_feedback_media as media
      on media.feedback_id = candidates.id
     and media.restaurant_id = p_restaurant_id
   order by candidates.created_at, candidates.id, media.position;
end;
$function$;

revoke all on function public.feedback_cleanup_candidates(uuid) from public, anon, authenticated;
grant execute on function public.feedback_cleanup_candidates(uuid) to authenticated;

create or replace function public.cleanup_feedback_drafts(p_restaurant_id uuid, p_feedback_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  removed_count integer;
begin
  if p_restaurant_id is null
     or not public.panel_menu_member(p_restaurant_id)
     or not exists (
       select 1
         from public.restaurants as restaurant
        where restaurant.id = p_restaurant_id
          and restaurant.status = 'active'
     ) then
    return 0;
  end if;

  if p_feedback_ids is null or pg_catalog.cardinality(p_feedback_ids) > 20 then
    raise exception 'feedback_cleanup_invalid' using errcode = '22023';
  end if;

  delete from public.restaurant_feedback as feedback
   where feedback.restaurant_id = p_restaurant_id
     and feedback.id = any(p_feedback_ids)
     and feedback.status in ('draft', 'deleted')
     and feedback.created_at < statement_timestamp() - interval '2 hours 16 minutes'
     and not exists (
       select 1
         from public.restaurant_feedback_media as media
         join storage.objects as object
           on object.name = media.storage_path
          and object.bucket_id = case when media.kind = 'image' then 'feedback-images' else 'feedback-videos' end
        where media.feedback_id = feedback.id
          and media.restaurant_id = feedback.restaurant_id
     );

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$function$;

revoke all on function public.cleanup_feedback_drafts(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.cleanup_feedback_drafts(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
