-- SMS doğrulaması veritabanında zorunlu: SMS gerektiren rollerde (super_admin) doğrulanmamış oturum CRM verisi okuyamaz/yazamaz.
create table if not exists crm.sms_required_roles (role_code text primary key);
insert into crm.sms_required_roles values ('super_admin') on conflict do nothing;
create table if not exists crm.sms_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  expires_at timestamptz not null
);
create index if not exists sms_sessions_user_idx on crm.sms_sessions (user_id);
alter table crm.sms_required_roles enable row level security;
alter table crm.sms_sessions enable row level security;
revoke all on crm.sms_required_roles, crm.sms_sessions from anon, authenticated;

create or replace function crm.sms_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from crm.user_roles ur join crm.sms_required_roles r on r.role_code = ur.role_code where ur.user_id = auth.uid())
      or exists (select 1 from crm.sms_sessions s where s.user_id = auth.uid()
                 and s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.expires_at > now())
$$;
revoke execute on function crm.sms_ok() from public, anon;
grant execute on function crm.sms_ok() to authenticated, service_role;

create or replace function crm.has_role(p_role text) returns boolean language sql stable security definer set search_path = '' as $$
  select crm.sms_ok() and exists (
    select 1 from crm.user_roles ur join crm.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role_code = p_role and p.is_active)
$$;
create or replace function crm.is_active_user() returns boolean language sql stable security definer set search_path = '' as $$
  select crm.sms_ok() and exists (select 1 from crm.profiles p where p.id = auth.uid() and p.is_active)
$$;
create or replace function crm.has_perm(p_perm text) returns boolean language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin() or (crm.sms_ok() and exists (
    select 1 from crm.user_roles ur
    join crm.role_permissions rp on rp.role_code = ur.role_code
    join crm.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and p.is_active and rp.permission_code = p_perm))
$$;
create or replace function crm.my_store_ids() returns setof uuid language sql stable security definer set search_path = '' as $$
  select sm.store_id from crm.store_memberships sm
  join crm.profiles p on p.id = sm.user_id
  where sm.user_id = auth.uid() and p.is_active and crm.sms_ok()
$$;
create or replace function crm.can_access_store(p_store uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin()
      or (p_store is not null and crm.sms_ok() and exists (
           select 1 from crm.store_memberships sm join crm.profiles p on p.id = sm.user_id
           where sm.user_id = auth.uid() and sm.store_id = p_store and p.is_active))
$$;
