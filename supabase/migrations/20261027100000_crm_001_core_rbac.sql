-- CRM Aşama 2-3: kurumsal yapı, kullanıcılar, RBAC, mağaza üyeliği, RLS, audit.
-- Bot tabloları (public.*) etkilenmez; her şey `crm` şemasında.

create schema if not exists crm;

revoke all on schema crm from public, anon;
grant usage on schema crm to authenticated, service_role;

alter default privileges in schema crm revoke all on tables from public, anon;
alter default privileges in schema crm grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema crm grant all on tables to service_role;
alter default privileges in schema crm grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema crm revoke execute on functions from public, anon;
alter default privileges in schema crm grant execute on functions to authenticated, service_role;

create or replace function crm.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── Organizasyon ─────────────
create table crm.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crm.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  store_type text not null default 'store' check (store_type in ('store','hq','online')),
  city text,
  address text,
  phone text,
  manager_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table crm.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references crm.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table crm.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references crm.organizations(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  department_id uuid references crm.departments(id) on delete set null,
  is_active boolean not null default true,
  last_sign_in_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_uq on crm.profiles (lower(email));
create index profiles_org_idx on crm.profiles (organization_id);
create index profiles_department_idx on crm.profiles (department_id);

alter table crm.stores
  add constraint stores_manager_fk foreign key (manager_id) references crm.profiles(id) on delete set null;
create index stores_org_idx on crm.stores (organization_id);
create index stores_manager_idx on crm.stores (manager_id);

create table crm.teams (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references crm.stores(id) on delete cascade,
  department_id uuid references crm.departments(id) on delete set null,
  name text not null,
  lead_id uuid references crm.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);
create index teams_dept_idx on crm.teams (department_id);
create index teams_lead_idx on crm.teams (lead_id);

-- ───────────── RBAC ─────────────
create table crm.roles (
  code text primary key,
  name text not null,
  description text,
  scope text not null check (scope in ('all','stores','own')),
  sort_order int not null default 0
);
create table crm.permissions (
  code text primary key,
  module text not null,
  description text not null
);
create table crm.role_permissions (
  role_code text not null references crm.roles(code) on delete cascade,
  permission_code text not null references crm.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);
create index role_permissions_perm_idx on crm.role_permissions (permission_code);

create table crm.user_roles (
  user_id uuid not null references crm.profiles(id) on delete cascade,
  role_code text not null references crm.roles(code) on delete restrict,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create index user_roles_role_idx on crm.user_roles (role_code);

create table crm.store_memberships (
  user_id uuid not null references crm.profiles(id) on delete cascade,
  store_id uuid not null references crm.stores(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index store_memberships_store_idx on crm.store_memberships (store_id);
create unique index store_memberships_one_primary on crm.store_memberships (user_id) where is_primary;

-- ───────────── Sistem ─────────────
create table crm.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  store_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on crm.audit_logs (created_at desc);
create index audit_logs_record_idx on crm.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on crm.audit_logs (actor_id);

create table crm.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create trigger organizations_updated before update on crm.organizations for each row execute function crm.set_updated_at();
create trigger stores_updated        before update on crm.stores        for each row execute function crm.set_updated_at();
create trigger profiles_updated      before update on crm.profiles      for each row execute function crm.set_updated_at();

-- ───────────── Yetki yardımcıları (SECURITY DEFINER, user metadata KULLANMAZ) ─────────────
create function crm.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from crm.profiles p where p.id = auth.uid() and p.is_active)
$$;

create function crm.has_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from crm.user_roles ur join crm.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role_code = p_role and p.is_active)
$$;

create function crm.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select crm.has_role('super_admin')
$$;

create function crm.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin() or exists (
    select 1 from crm.user_roles ur
    join crm.role_permissions rp on rp.role_code = ur.role_code
    join crm.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and p.is_active and rp.permission_code = p_perm)
$$;

create function crm.my_store_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select sm.store_id from crm.store_memberships sm
  join crm.profiles p on p.id = sm.user_id
  where sm.user_id = auth.uid() and p.is_active
$$;

create function crm.can_access_store(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin()
      or (p_store is not null and exists (
           select 1 from crm.store_memberships sm join crm.profiles p on p.id = sm.user_id
           where sm.user_id = auth.uid() and sm.store_id = p_store and p.is_active))
$$;

create function crm.shares_store_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from crm.store_memberships a
    join crm.store_memberships b on b.store_id = a.store_id
    where a.user_id = auth.uid() and b.user_id = p_user)
$$;

-- ───────────── Audit ─────────────
create function crm.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_new jsonb; v_old jsonb; v_row jsonb;
begin
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  v_row := coalesce(v_new, v_old);
  insert into crm.audit_logs (actor_id, action, table_name, record_id, store_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(v_row->>'id', v_row->>'user_id'),
          nullif(v_row->>'store_id','')::uuid, v_old, v_new);
  return null;
end $$;

create trigger audit_stores            after insert or update or delete on crm.stores            for each row execute function crm.audit_trigger();
create trigger audit_profiles          after insert or update or delete on crm.profiles          for each row execute function crm.audit_trigger();
create trigger audit_user_roles        after insert or update or delete on crm.user_roles        for each row execute function crm.audit_trigger();
create trigger audit_store_memberships after insert or update or delete on crm.store_memberships for each row execute function crm.audit_trigger();
create trigger audit_role_permissions  after insert or update or delete on crm.role_permissions  for each row execute function crm.audit_trigger();

-- Son giriş zamanı (auth.users -> profiles)
create function crm.sync_last_sign_in() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update crm.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end $$;
create trigger crm_sync_last_sign_in after update of last_sign_in_at on auth.users
  for each row when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function crm.sync_last_sign_in();

-- ───────────── RLS ─────────────
alter table crm.organizations     enable row level security;
alter table crm.stores            enable row level security;
alter table crm.departments       enable row level security;
alter table crm.profiles          enable row level security;
alter table crm.teams             enable row level security;
alter table crm.roles             enable row level security;
alter table crm.permissions       enable row level security;
alter table crm.role_permissions  enable row level security;
alter table crm.user_roles        enable row level security;
alter table crm.store_memberships enable row level security;
alter table crm.audit_logs        enable row level security;
alter table crm.system_settings   enable row level security;

-- Salt-okunur referans tablolar: yazma yalnızca service_role / migration
revoke insert, update, delete on crm.roles, crm.permissions, crm.role_permissions, crm.audit_logs from authenticated;

create policy org_read on crm.organizations for select to authenticated using ((select crm.is_active_user()));
create policy org_write on crm.organizations for all to authenticated
  using ((select crm.is_super_admin())) with check ((select crm.is_super_admin()));

create policy dept_read on crm.departments for select to authenticated using ((select crm.is_active_user()));
create policy dept_write on crm.departments for all to authenticated
  using ((select crm.is_super_admin())) with check ((select crm.is_super_admin()));

create policy roles_read on crm.roles for select to authenticated using ((select crm.is_active_user()));
create policy perms_read on crm.permissions for select to authenticated using ((select crm.is_active_user()));
create policy rp_read on crm.role_permissions for select to authenticated using ((select crm.is_active_user()));

create policy stores_read on crm.stores for select to authenticated using ((select crm.can_access_store(id)));
create policy stores_write on crm.stores for all to authenticated
  using ((select crm.has_perm('stores.manage'))) with check ((select crm.has_perm('stores.manage')));

create policy teams_read on crm.teams for select to authenticated using ((select crm.can_access_store(store_id)));
create policy teams_write on crm.teams for all to authenticated
  using ((select crm.has_perm('users.manage')) and (select crm.can_access_store(store_id)))
  with check ((select crm.has_perm('users.manage')) and (select crm.can_access_store(store_id)));

create policy profiles_read on crm.profiles for select to authenticated
  using (id = (select auth.uid()) or (select crm.is_super_admin()) or (select crm.shares_store_with(id)));
create policy profiles_update on crm.profiles for update to authenticated
  using ((select crm.is_super_admin()) or ((select crm.has_perm('users.manage')) and (select crm.shares_store_with(id))))
  with check ((select crm.is_super_admin()) or ((select crm.has_perm('users.manage')) and (select crm.shares_store_with(id))));
create policy profiles_insert on crm.profiles for insert to authenticated with check ((select crm.is_super_admin()));
create policy profiles_delete on crm.profiles for delete to authenticated using ((select crm.is_super_admin()));

-- Rol atama = yetki yükseltme: yalnızca Super Admin
create policy user_roles_read on crm.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select crm.is_super_admin()) or (select crm.shares_store_with(user_id)));
create policy user_roles_write on crm.user_roles for all to authenticated
  using ((select crm.is_super_admin())) with check ((select crm.is_super_admin()));

create policy sm_read on crm.store_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select crm.can_access_store(store_id)));
create policy sm_write on crm.store_memberships for all to authenticated
  using ((select crm.is_super_admin()) or ((select crm.has_perm('users.manage')) and (select crm.can_access_store(store_id))))
  with check ((select crm.is_super_admin()) or ((select crm.has_perm('users.manage')) and (select crm.can_access_store(store_id))));

create policy audit_read on crm.audit_logs for select to authenticated using ((select crm.has_perm('audit.read')));
create policy settings_all on crm.system_settings for all to authenticated
  using ((select crm.is_super_admin())) with check ((select crm.is_super_admin()));

-- ───────────── Tohumlar (yapısal; sahte müşteri/satış verisi YOK) ─────────────
insert into crm.roles (code, name, description, scope, sort_order) values
 ('super_admin','Super Admin','Tüm sisteme tam erişim','all',1),
 ('executive','Üst Yönetim','Yetkili olduğu mağazaların raporları ve görünümü','stores',2),
 ('crm_marketing','CRM / Pazarlama','Segment, kampanya, izin ve müşteri verisi yönetimi','stores',3),
 ('store_manager','Mağaza Müdürü','Kendi mağazasındaki tüm işlemler ve ekip','stores',4),
 ('sales_advisor','Satış Danışmanı','Kendi müşteri portföyü ve atanmış kayıtlar','own',5),
 ('ecommerce_support','E-ticaret / Müşteri Hizmetleri','Online kanal müşteri talepleri','stores',6),
 ('after_sales','Satış Sonrası Hizmetler','Servis talepleri ve ilgili müşteri kayıtları','stores',7),
 ('b2b_manager','B2B / Bayi Yöneticisi','Kurumsal hesap ve bayi yönetimi','stores',8);

insert into crm.permissions (code, module, description) values
 ('dashboard.read','dashboard','Dashboard görüntüleme'),
 ('customers.read','customers','Müşteri görüntüleme'),
 ('customers.write','customers','Müşteri oluşturma/düzenleme'),
 ('customers.delete','customers','Müşteri anonimleştirme/silme'),
 ('customers.merge','customers','Müşteri birleştirme'),
 ('customers.export','customers','Müşteri dışa aktarma'),
 ('opportunities.read','sales','Satış fırsatı görüntüleme'),
 ('opportunities.write','sales','Satış fırsatı yönetimi'),
 ('quotations.write','sales','Teklif yönetimi'),
 ('orders.read','sales','Sipariş görüntüleme'),
 ('products.read','products','Ürün/koleksiyon görüntüleme'),
 ('products.write','products','Ürün/koleksiyon yönetimi'),
 ('tasks.read','tasks','Görev görüntüleme'),
 ('tasks.write','tasks','Görev yönetimi'),
 ('tasks.team','tasks','Ekip görevlerini izleme'),
 ('appointments.read','tasks','Randevu görüntüleme'),
 ('appointments.write','tasks','Randevu yönetimi'),
 ('segments.read','marketing','Segment görüntüleme'),
 ('segments.write','marketing','Segment yönetimi'),
 ('campaigns.read','marketing','Kampanya görüntüleme'),
 ('campaigns.write','marketing','Kampanya yönetimi'),
 ('campaigns.send','marketing','Kampanya gönderimi'),
 ('consents.read','marketing','İletişim izni görüntüleme'),
 ('consents.write','marketing','İletişim izni yönetimi'),
 ('vip.manage','marketing','VIP / clienteling yönetimi'),
 ('service.read','service','Servis talebi görüntüleme'),
 ('service.write','service','Servis talebi yönetimi'),
 ('b2b.read','b2b','B2B görüntüleme'),
 ('b2b.write','b2b','B2B yönetimi'),
 ('reports.read','reports','Rapor görüntüleme'),
 ('reports.export','reports','Rapor/CSV dışa aktarma'),
 ('users.read','admin','Kullanıcı listesi'),
 ('users.manage','admin','Kullanıcı/üyelik yönetimi'),
 ('stores.manage','admin','Mağaza yönetimi'),
 ('integrations.manage','admin','Entegrasyon yönetimi'),
 ('audit.read','admin','Denetim kaydı görüntüleme'),
 ('settings.manage','admin','Sistem ayarları');

insert into crm.role_permissions (role_code, permission_code)
select 'super_admin', code from crm.permissions;

insert into crm.role_permissions (role_code, permission_code)
select r, p from (values
 ('executive','dashboard.read'),('executive','customers.read'),('executive','opportunities.read'),('executive','orders.read'),
 ('executive','products.read'),('executive','tasks.read'),('executive','tasks.team'),('executive','appointments.read'),
 ('executive','segments.read'),('executive','campaigns.read'),('executive','consents.read'),('executive','service.read'),
 ('executive','b2b.read'),('executive','reports.read'),('executive','reports.export'),('executive','users.read'),

 ('crm_marketing','dashboard.read'),('crm_marketing','customers.read'),('crm_marketing','customers.write'),
 ('crm_marketing','customers.merge'),('crm_marketing','customers.export'),('crm_marketing','opportunities.read'),
 ('crm_marketing','orders.read'),('crm_marketing','products.read'),('crm_marketing','tasks.read'),('crm_marketing','tasks.write'),
 ('crm_marketing','appointments.read'),('crm_marketing','segments.read'),('crm_marketing','segments.write'),
 ('crm_marketing','campaigns.read'),('crm_marketing','campaigns.write'),('crm_marketing','campaigns.send'),
 ('crm_marketing','consents.read'),('crm_marketing','consents.write'),('crm_marketing','vip.manage'),
 ('crm_marketing','reports.read'),('crm_marketing','reports.export'),

 ('store_manager','dashboard.read'),('store_manager','customers.read'),('store_manager','customers.write'),
 ('store_manager','customers.merge'),('store_manager','opportunities.read'),('store_manager','opportunities.write'),
 ('store_manager','quotations.write'),('store_manager','orders.read'),('store_manager','products.read'),
 ('store_manager','tasks.read'),('store_manager','tasks.write'),('store_manager','tasks.team'),
 ('store_manager','appointments.read'),('store_manager','appointments.write'),('store_manager','segments.read'),
 ('store_manager','campaigns.read'),('store_manager','consents.read'),('store_manager','consents.write'),
 ('store_manager','vip.manage'),('store_manager','service.read'),('store_manager','service.write'),
 ('store_manager','reports.read'),('store_manager','users.read'),('store_manager','users.manage'),

 ('sales_advisor','dashboard.read'),('sales_advisor','customers.read'),('sales_advisor','customers.write'),
 ('sales_advisor','opportunities.read'),('sales_advisor','opportunities.write'),('sales_advisor','quotations.write'),
 ('sales_advisor','orders.read'),('sales_advisor','products.read'),('sales_advisor','tasks.read'),('sales_advisor','tasks.write'),
 ('sales_advisor','appointments.read'),('sales_advisor','appointments.write'),('sales_advisor','consents.read'),
 ('sales_advisor','consents.write'),('sales_advisor','service.read'),

 ('ecommerce_support','dashboard.read'),('ecommerce_support','customers.read'),('ecommerce_support','customers.write'),
 ('ecommerce_support','opportunities.read'),('ecommerce_support','opportunities.write'),('ecommerce_support','orders.read'),
 ('ecommerce_support','products.read'),('ecommerce_support','tasks.read'),('ecommerce_support','tasks.write'),
 ('ecommerce_support','appointments.read'),('ecommerce_support','appointments.write'),('ecommerce_support','consents.read'),
 ('ecommerce_support','service.read'),('ecommerce_support','service.write'),

 ('after_sales','dashboard.read'),('after_sales','customers.read'),('after_sales','orders.read'),('after_sales','products.read'),
 ('after_sales','tasks.read'),('after_sales','tasks.write'),('after_sales','service.read'),('after_sales','service.write'),

 ('b2b_manager','dashboard.read'),('b2b_manager','b2b.read'),('b2b_manager','b2b.write'),('b2b_manager','customers.read'),
 ('b2b_manager','orders.read'),('b2b_manager','products.read'),('b2b_manager','opportunities.read'),
 ('b2b_manager','tasks.read'),('b2b_manager','tasks.write'),('b2b_manager','reports.read')
) as t(r, p);

with org as (
  insert into crm.organizations (name, legal_name) values ('Roberto Bravo', null) returning id
)
insert into crm.departments (organization_id, name)
select org.id, d from org, unnest(array['Yönetim','CRM / Pazarlama','Satış','E-ticaret / Müşteri Hizmetleri','Satış Sonrası','B2B / Bayi']) d;

-- Yapısal kanallar: merkez ofis + online kanal. Fiziksel mağazalar arayüzden eklenir.
insert into crm.stores (organization_id, code, name, store_type)
select o.id, c.code, c.name, c.t from crm.organizations o,
  (values ('HQ','Merkez Ofis','hq'), ('ONLINE','E-ticaret','online')) as c(code, name, t);

-- İlk Super Admin: yalnızca henüz hiç Super Admin yokken, service_role/postgres ile çağrılır
create function crm.bootstrap_super_admin(p_email text, p_first text, p_last text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_org uuid; v_hq uuid;
begin
  if exists (select 1 from crm.user_roles where role_code = 'super_admin') then
    raise exception 'Super Admin zaten mevcut';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then raise exception 'Önce bu e-posta ile Supabase Auth kullanıcısı oluşturulmalı'; end if;
  select id into v_org from crm.organizations limit 1;
  select id into v_hq from crm.stores where code = 'HQ';
  insert into crm.profiles (id, organization_id, first_name, last_name, email)
    values (v_uid, v_org, p_first, p_last, lower(p_email));
  insert into crm.user_roles (user_id, role_code, granted_by) values (v_uid, 'super_admin', v_uid);
  insert into crm.store_memberships (user_id, store_id, is_primary) values (v_uid, v_hq, true);
  return v_uid;
end $$;
revoke execute on function crm.bootstrap_super_admin(text, text, text) from public, anon, authenticated;
grant execute on function crm.bootstrap_super_admin(text, text, text) to service_role;

-- crm şemasını PostgREST'e aç
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, crm';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
