-- Cargos explícitos de equipe. `position` permanece para compatibilidade com
-- o RPC do convite de plataforma criado antes desta migration.

alter table public.memberships
  add column role text not null default 'admin';

update public.memberships
set role = 'admin',
    position = 'Administrador';

alter table public.memberships
  add constraint memberships_role_check
    check (role in ('admin', 'cashier', 'attendant', 'waiter'));

comment on column public.memberships.role is
  'Cargo da pessoa na equipe. Nesta versão, somente alteração de cargo exige admin; demais permissões do painel continuam baseadas em membership ativa.';

comment on column public.memberships.position is
  'Campo legado mantido para compatibilidade com o aceite do convite de plataforma; usar role nas novas operações de equipe.';

create function public.panel_is_restaurant_admin(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships as membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = 'admin'
  );
$function$;

revoke all on function public.panel_is_restaurant_admin(uuid) from PUBLIC, anon, authenticated;

comment on function public.panel_is_restaurant_admin(uuid) is
  'Confere se a sessão autenticada é admin ativo do restaurante indicado.';
