-- CRM Aşama 4: Müşteri 360°, iletişim izinleri, ürün/koleksiyon

create extension if not exists pg_trgm with schema extensions;

insert into crm.permissions (code, module, description) values
  ('customers.assign','customers','Müşteri danışman ataması/devri');
insert into crm.role_permissions (role_code, permission_code) values
  ('super_admin','customers.assign'),('crm_marketing','customers.assign'),('store_manager','customers.assign');

-- ───────────── Normalleştiriciler ─────────────
create function crm.norm_phone(p text) returns text language sql immutable set search_path = '' as $$
  select case when d is null or length(d) < 10 then null else right(d, 10) end
  from (select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '') as d) x
$$;
create function crm.norm_email(p text) returns text language sql immutable set search_path = '' as $$
  select nullif(lower(btrim(coalesce(p, ''))), '')
$$;

-- ───────────── Ürün / Koleksiyon ─────────────
create table crm.collections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  source_system text,
  source_id text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index collections_source_uq on crm.collections (source_system, source_id) where source_system is not null;

create table crm.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  collection_id uuid references crm.collections(id) on delete set null,
  category text,
  material text,
  description text,
  image_urls text[] not null default '{}',
  price numeric(14,2),
  currency text not null default 'TRY',
  status text not null default 'active' check (status in ('draft','active','discontinued')),
  source_system text,
  source_id text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_source_uq on crm.products (source_system, source_id) where source_system is not null;
create index products_collection_idx on crm.products (collection_id);
create index products_name_trgm on crm.products using gin (name extensions.gin_trgm_ops);

create table crm.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references crm.products(id) on delete cascade,
  sku text not null unique,
  label text not null,
  attributes jsonb not null default '{}',
  price numeric(14,2),
  currency text not null default 'TRY',
  status text not null default 'active' check (status in ('draft','active','discontinued')),
  source_system text,
  source_id text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on crm.product_variants (product_id);
create unique index product_variants_source_uq on crm.product_variants (source_system, source_id) where source_system is not null;

-- ERP/ürün sistemi yetkili kaynaksa fiyat/SKU/para birimi CRM kullanıcısı tarafından değiştirilemez
create function crm.guard_sourced_product() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.source_system is not null
     and current_user not in ('service_role', 'postgres', 'supabase_admin')
     and (new.price is distinct from old.price or new.currency is distinct from old.currency
          or new.sku is distinct from old.sku or new.source_system is distinct from old.source_system) then
    raise exception 'Bu kayıt % sisteminden senkronize edilir; fiyat/SKU CRM''de değiştirilemez', old.source_system;
  end if;
  return new;
end $$;
create trigger products_guard before update on crm.products for each row execute function crm.guard_sourced_product();
create trigger variants_guard before update on crm.product_variants for each row execute function crm.guard_sourced_product();
create trigger collections_updated before update on crm.collections for each row execute function crm.set_updated_at();
create trigger products_updated before update on crm.products for each row execute function crm.set_updated_at();
create trigger variants_updated before update on crm.product_variants for each row execute function crm.set_updated_at();

-- ───────────── Müşteri ─────────────
create table crm.customers (
  id uuid primary key default gen_random_uuid(),
  customer_no bigint generated always as identity unique,
  organization_id uuid not null references crm.organizations(id) on delete restrict,
  store_id uuid not null references crm.stores(id) on delete restrict,
  assigned_to uuid references crm.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null default '',
  phone text,
  phone_norm text,
  email text,
  email_norm text,
  source text not null default 'other' check (source in ('walk_in','whatsapp','ecommerce','referral','event','social','phone','other')),
  registered_at timestamptz not null default now(),
  birth_date date,
  city text,
  is_vip boolean not null default false,
  vip_since timestamptz,
  total_spent numeric(14,2) not null default 0,
  order_count int not null default 0,
  last_purchase_at timestamptz,
  status text not null default 'active' check (status in ('active','anonymized','merged')),
  merged_into uuid references crm.customers(id) on delete set null,
  anonymized_at timestamptz,
  search_text text generated always as (lower(first_name || ' ' || last_name || ' ' || coalesce(email, '') || ' ' || coalesce(phone, ''))) stored,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_phone_uq on crm.customers (organization_id, phone_norm) where status = 'active' and phone_norm is not null;
create unique index customers_email_uq on crm.customers (organization_id, email_norm) where status = 'active' and email_norm is not null;
create index customers_store_idx on crm.customers (store_id);
create index customers_assigned_idx on crm.customers (assigned_to);
create index customers_vip_idx on crm.customers (store_id) where is_vip;
create index customers_registered_idx on crm.customers (registered_at desc);
create index customers_last_purchase_idx on crm.customers (last_purchase_at desc nulls last);
create index customers_status_idx on crm.customers (status);
create index customers_search_trgm on crm.customers using gin (search_text extensions.gin_trgm_ops);
create index customers_merged_into_idx on crm.customers (merged_into) where merged_into is not null;

-- Merkezi profil: müşteri birden fazla mağazada görünür
create table crm.customer_stores (
  customer_id uuid not null references crm.customers(id) on delete cascade,
  store_id uuid not null references crm.stores(id) on delete cascade,
  linked_at timestamptz not null default now(),
  linked_by uuid,
  primary key (customer_id, store_id)
);
create index customer_stores_store_idx on crm.customer_stores (store_id);

create table crm.customer_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  advisor_id uuid not null references crm.profiles(id) on delete cascade,
  assigned_by uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text
);
create index customer_assignments_customer_idx on crm.customer_assignments (customer_id);
create index customer_assignments_advisor_idx on crm.customer_assignments (advisor_id) where ended_at is null;

create table crm.customer_external_ids (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  source_system text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (source_system, external_id)
);
create index customer_external_ids_customer_idx on crm.customer_external_ids (customer_id);

create table crm.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  label text not null default 'Ev',
  line text not null,
  district text,
  city text,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index customer_addresses_customer_idx on crm.customer_addresses (customer_id);

create table crm.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  body text not null,
  author_id uuid references crm.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index customer_notes_customer_idx on crm.customer_notes (customer_id, created_at desc);

create table crm.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  store_id uuid references crm.stores(id) on delete set null,
  user_id uuid references crm.profiles(id) on delete set null,
  type text not null check (type in ('call','meeting','whatsapp','email','sms','visit','other')),
  direction text check (direction in ('inbound','outbound')),
  summary text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index customer_interactions_customer_idx on crm.customer_interactions (customer_id, occurred_at desc);
create index customer_interactions_user_idx on crm.customer_interactions (user_id);

create table crm.store_visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  store_id uuid not null references crm.stores(id) on delete restrict,
  advisor_id uuid references crm.profiles(id) on delete set null,
  visited_at timestamptz not null default now(),
  purpose text,
  outcome text,
  notes text,
  created_at timestamptz not null default now()
);
create index store_visits_customer_idx on crm.store_visits (customer_id, visited_at desc);
create index store_visits_store_idx on crm.store_visits (store_id, visited_at desc);
create index store_visits_advisor_idx on crm.store_visits (advisor_id);

create table crm.customer_product_interests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  product_id uuid references crm.products(id) on delete cascade,
  collection_id uuid references crm.collections(id) on delete cascade,
  note text,
  created_by uuid references crm.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (product_id is not null or collection_id is not null)
);
create index customer_interests_customer_idx on crm.customer_product_interests (customer_id);
create index customer_interests_product_idx on crm.customer_product_interests (product_id);
create index customer_interests_collection_idx on crm.customer_product_interests (collection_id);

create table crm.customer_merges (
  id uuid primary key default gen_random_uuid(),
  primary_id uuid not null references crm.customers(id) on delete cascade,
  secondary_id uuid not null references crm.customers(id) on delete cascade,
  merged_by uuid,
  reason text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index customer_merges_primary_idx on crm.customer_merges (primary_id);
create index customer_merges_secondary_idx on crm.customer_merges (secondary_id);

-- ───────────── İletişim izinleri (ayrı kayıt + olay geçmişi) ─────────────
create table crm.customer_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  channel text not null check (channel in ('sms','email','call','whatsapp')),
  purpose text not null default 'marketing' check (purpose in ('marketing','service')),
  status text not null default 'unknown' check (status in ('unknown','pending','granted','revoked')),
  source text check (source in ('store_form','web','iys','verbal','import','other')),
  granted_at timestamptz,
  revoked_at timestamptz,
  iys_ref text,
  iys_sync text not null default 'not_synced' check (iys_sync in ('not_synced','synced','failed')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (customer_id, channel, purpose)
);
create index customer_consents_customer_idx on crm.customer_consents (customer_id);

create table crm.consent_events (
  id bigint generated always as identity primary key,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  channel text not null,
  purpose text not null,
  action text not null,
  source text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index consent_events_customer_idx on crm.consent_events (customer_id, created_at desc);

-- ───────────── Erişim fonksiyonları ─────────────
create function crm.my_scope() returns text language sql stable security definer set search_path = '' as $$
  select case when bool_or(r.scope = 'all') then 'all' when bool_or(r.scope = 'stores') then 'stores'
              when bool_or(r.scope = 'own') then 'own' end
  from crm.user_roles ur join crm.roles r on r.code = ur.role_code
  join crm.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.is_active
$$;

create function crm.can_access_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin() or exists (
    select 1 from crm.customers c
    where c.id = p_customer and crm.is_active_user() and (
      c.assigned_to = auth.uid()
      or (crm.my_scope() = 'stores' and exists (
            select 1 from crm.customer_stores cs
            where cs.customer_id = c.id and cs.store_id in (select crm.my_store_ids())))
      or exists (select 1 from crm.customer_assignments a
                 where a.customer_id = c.id and a.advisor_id = auth.uid() and a.ended_at is null)))
$$;

create function crm.can_contact(p_customer uuid, p_channel text, p_purpose text default 'marketing') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from crm.customers c join crm.customer_consents k on k.customer_id = c.id
    where c.id = p_customer and c.status = 'active'
      and k.channel = p_channel and k.purpose = p_purpose and k.status = 'granted')
$$;

-- ───────────── Tetikleyiciler ─────────────
create function crm.customers_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.first_name := btrim(new.first_name);
  new.last_name := btrim(coalesce(new.last_name, ''));
  new.phone_norm := crm.norm_phone(new.phone);
  new.email := crm.norm_email(new.email);
  new.email_norm := new.email;
  if new.first_name = '' then raise exception 'Ad zorunlu'; end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.assigned_to is null and auth.uid() is not null and crm.has_role('sales_advisor') then
      new.assigned_to := auth.uid();
    end if;
  end if;

  if new.status = 'active' and new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to or new.store_id is distinct from old.store_id) then
    if not exists (select 1 from crm.store_memberships where user_id = new.assigned_to and store_id = new.store_id) then
      raise exception 'Atanan danışman bu mağazaya bağlı değil';
    end if;
  end if;

  -- Danışman ataması/devri yetkisi (sahipsiz müşteriyi kendine almak serbest)
  if tg_op = 'UPDATE' and auth.uid() is not null and new.assigned_to is distinct from old.assigned_to
     and not crm.has_perm('customers.assign')
     and not (old.assigned_to is null and new.assigned_to = auth.uid()) then
    raise exception 'Danışman ataması için yetkiniz yok';
  end if;

  -- VIP durumu yalnızca vip.manage yetkisiyle değişir
  if auth.uid() is not null and ((tg_op = 'INSERT' and new.is_vip) or (tg_op = 'UPDATE' and new.is_vip is distinct from old.is_vip))
     and not crm.has_perm('vip.manage') then
    raise exception 'VIP statüsünü değiştirme yetkiniz yok';
  end if;
  if new.is_vip then new.vip_since := coalesce(new.vip_since, now()); else new.vip_since := null; end if;
  return new;
end $$;
create trigger customers_before_biu before insert or update on crm.customers
  for each row execute function crm.customers_before();
create trigger customers_updated before update on crm.customers for each row execute function crm.set_updated_at();

create function crm.customers_after_insert() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into crm.customer_stores (customer_id, store_id, linked_by) values (new.id, new.store_id, new.created_by)
    on conflict do nothing;
  if new.assigned_to is not null then
    insert into crm.customer_assignments (customer_id, advisor_id, assigned_by) values (new.id, new.assigned_to, new.created_by);
  end if;
  return null;
end $$;
create trigger customers_ai after insert on crm.customers for each row execute function crm.customers_after_insert();

create function crm.customers_after_assign() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update crm.customer_assignments set ended_at = now() where customer_id = new.id and ended_at is null;
  if new.assigned_to is not null then
    insert into crm.customer_assignments (customer_id, advisor_id, assigned_by) values (new.id, new.assigned_to, auth.uid());
  end if;
  return null;
end $$;
create trigger customers_au_assign after update of assigned_to on crm.customers
  for each row when (new.assigned_to is distinct from old.assigned_to) execute function crm.customers_after_assign();

-- İzin değişiklikleri → olay geçmişi
create function crm.consent_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  if new.status = 'granted' and (tg_op = 'INSERT' or old.status is distinct from 'granted') then new.granted_at := now(); new.revoked_at := null; end if;
  if new.status = 'revoked' and (tg_op = 'INSERT' or old.status is distinct from 'revoked') then new.revoked_at := now(); end if;
  return new;
end $$;
create trigger consent_before_biu before insert or update on crm.customer_consents for each row execute function crm.consent_before();

create function crm.consent_after() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into crm.consent_events (customer_id, channel, purpose, action, source, actor_id)
    values (new.customer_id, new.channel, new.purpose, new.status, new.source, auth.uid());
  end if;
  return null;
end $$;
create trigger consent_after_aiu after insert or update on crm.customer_consents for each row execute function crm.consent_after();

-- PII içermeyen denetim: yalnızca kayıt kimliği ve değişen kolon adları
create function crm.audit_trigger_min() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_new jsonb; v_old jsonb; v_row jsonb; v_changed text[];
begin
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  v_row := coalesce(v_new, v_old);
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed from jsonb_object_keys(v_new) k
    where (v_new -> k) is distinct from (v_old -> k) and k not in ('updated_at','search_text');
    if v_changed is null then return null; end if;
  end if;
  insert into crm.audit_logs (actor_id, action, table_name, record_id, store_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name, coalesce(v_row->>'id', v_row->>'customer_id'),
          nullif(v_row->>'store_id','')::uuid, null,
          case when v_changed is not null then jsonb_build_object('changed', to_jsonb(v_changed)) end);
  return null;
end $$;
create trigger audit_customers after insert or update or delete on crm.customers for each row execute function crm.audit_trigger_min();
create trigger audit_customer_stores after insert or delete on crm.customer_stores for each row execute function crm.audit_trigger_min();
create trigger audit_customer_consents after insert or update or delete on crm.customer_consents for each row execute function crm.audit_trigger_min();
create trigger audit_customer_addresses after insert or update or delete on crm.customer_addresses for each row execute function crm.audit_trigger_min();
create trigger audit_customer_merges after insert on crm.customer_merges for each row execute function crm.audit_trigger_min();
create trigger audit_products after insert or update or delete on crm.products for each row execute function crm.audit_trigger();

-- ───────────── Sipariş istatistikleri (orders tablosu Aşama 5'te gelir; fonksiyon hazır) ─────────────
create function crm.refresh_customer_stats(p_customer uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if to_regclass('crm.orders') is null then return; end if;
  execute $q$
    update crm.customers c set
      total_spent = coalesce(s.t, 0), order_count = coalesce(s.n, 0), last_purchase_at = s.l
    from (select sum(total) filter (where status in ('paid','shipped','delivered')) t,
                 count(*) filter (where status in ('paid','shipped','delivered')) n,
                 max(ordered_at) filter (where status in ('paid','shipped','delivered')) l
          from crm.orders where customer_id = $1 and not is_test) s
    where c.id = $1$q$ using p_customer;
end $$;

-- ───────────── İş fonksiyonları ─────────────
create function crm.find_duplicates(p_phone text, p_email text)
returns table (id uuid, customer_no bigint, display_name text, store_name text, accessible boolean, match_on text)
language sql stable security definer set search_path = '' as $$
  select x.id, x.customer_no,
         case when x.acc then btrim(x.first_name || ' ' || x.last_name)
              else left(x.first_name, 1) || repeat('*', greatest(length(x.first_name) - 1, 1)) || ' ' ||
                   left(x.last_name, 1) || repeat('*', greatest(length(x.last_name) - 1, 0)) end,
         x.store_name, x.acc, x.match_on
  from (
    select c.id, c.customer_no, c.first_name, c.last_name, s.name as store_name,
           crm.can_access_customer(c.id) as acc,
           concat_ws('+', case when crm.norm_phone(p_phone) is not null and c.phone_norm = crm.norm_phone(p_phone) then 'telefon' end,
                          case when crm.norm_email(p_email) is not null and c.email_norm = crm.norm_email(p_email) then 'e-posta' end) as match_on
    from crm.customers c join crm.stores s on s.id = c.store_id
    where crm.has_perm('customers.write') and c.status = 'active'
      and ((crm.norm_phone(p_phone) is not null and c.phone_norm = crm.norm_phone(p_phone))
        or (crm.norm_email(p_email) is not null and c.email_norm = crm.norm_email(p_email)))
  ) x
$$;

create function crm.link_customer_to_store(p_customer uuid, p_store uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not crm.has_perm('customers.write') or not crm.can_access_store(p_store) then
    raise exception 'Yetkiniz yok' using errcode = '42501';
  end if;
  if not exists (select 1 from crm.customers where id = p_customer and status = 'active') then
    raise exception 'Müşteri bulunamadı';
  end if;
  insert into crm.customer_stores (customer_id, store_id, linked_by) values (p_customer, p_store, auth.uid())
    on conflict do nothing;
end $$;

create function crm.merge_customers(p_primary uuid, p_secondary uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; v_sec crm.customers; v_pri crm.customers;
begin
  if p_primary = p_secondary then raise exception 'Aynı müşteri seçildi'; end if;
  if not crm.has_perm('customers.merge') or not crm.can_access_customer(p_primary) or not crm.can_access_customer(p_secondary) then
    raise exception 'Yetkiniz yok' using errcode = '42501';
  end if;
  select * into v_pri from crm.customers where id = p_primary for update;
  select * into v_sec from crm.customers where id = p_secondary for update;
  if v_pri.status <> 'active' or v_sec.status <> 'active' then raise exception 'Her iki müşteri de aktif olmalı'; end if;

  insert into crm.customer_merges (primary_id, secondary_id, merged_by, reason, snapshot)
  values (p_primary, p_secondary, auth.uid(), p_reason, to_jsonb(v_sec));

  -- İkincil kaydı pasifleştir (benzersiz telefon/e-posta serbest kalır)
  update crm.customers set status = 'merged', merged_into = p_primary, assigned_to = null where id = p_secondary;
  update crm.customer_assignments set ended_at = now() where customer_id = p_secondary and ended_at is null;

  -- Birincil kayıttaki boş alanları doldur
  update crm.customers set
    phone = coalesce(phone, v_sec.phone), email = coalesce(email, v_sec.email),
    birth_date = coalesce(birth_date, v_sec.birth_date), city = coalesce(city, v_sec.city),
    registered_at = least(registered_at, v_sec.registered_at)
  where id = p_primary;

  -- customer_id taşıyan tüm tabloları (gelecekte eklenenler dahil) birincile taşı
  for r in
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'crm' and c.column_name = 'customer_id'
      and c.table_name not in ('customer_consents','customer_stores','customer_merges','consent_events')
  loop
    execute format('update crm.%I set customer_id = $1 where customer_id = $2', r.table_name) using p_primary, p_secondary;
  end loop;

  -- İzinler: iptal (revoked) her zaman kazanır
  insert into crm.customer_consents (customer_id, channel, purpose, status, source, granted_at, revoked_at, iys_ref, iys_sync)
  select p_primary, channel, purpose, status, source, granted_at, revoked_at, iys_ref, iys_sync
  from crm.customer_consents where customer_id = p_secondary
  on conflict (customer_id, channel, purpose) do update set
    status = case when excluded.status = 'revoked' or crm.customer_consents.status = 'revoked' then 'revoked'
                  when excluded.status = 'granted' or crm.customer_consents.status = 'granted' then 'granted'
                  else crm.customer_consents.status end;
  delete from crm.customer_consents where customer_id = p_secondary;

  insert into crm.customer_stores (customer_id, store_id, linked_by)
  select p_primary, store_id, auth.uid() from crm.customer_stores where customer_id = p_secondary
  on conflict do nothing;
  delete from crm.customer_stores where customer_id = p_secondary;

  perform crm.refresh_customer_stats(p_primary);
end $$;

create function crm.anonymize_customer(p_customer uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not crm.has_perm('customers.delete') or not crm.can_access_customer(p_customer) then
    raise exception 'Yetkiniz yok' using errcode = '42501';
  end if;
  if not exists (select 1 from crm.customers where id = p_customer and status = 'active') then
    raise exception 'Müşteri aktif değil';
  end if;
  update crm.customers set first_name = 'Anonim', last_name = 'Müşteri', phone = null, email = null,
    birth_date = null, city = null, assigned_to = null, is_vip = false, status = 'anonymized', anonymized_at = now()
  where id = p_customer;
  delete from crm.customer_addresses where customer_id = p_customer;
  delete from crm.customer_notes where customer_id = p_customer;
  update crm.customer_interactions set summary = '[anonimleştirildi]' where customer_id = p_customer;
  update crm.store_visits set notes = null where customer_id = p_customer;
  update crm.customer_consents set status = 'revoked' where customer_id = p_customer and status <> 'revoked';
  update crm.customer_assignments set ended_at = now() where customer_id = p_customer and ended_at is null;
  insert into crm.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'ANONYMIZE', 'customers', p_customer::text, jsonb_build_object('reason', p_reason));
end $$;

revoke execute on function crm.merge_customers(uuid, uuid, text), crm.anonymize_customer(uuid, text),
  crm.link_customer_to_store(uuid, uuid), crm.find_duplicates(text, text), crm.refresh_customer_stats(uuid),
  crm.can_contact(uuid, text, text) from public, anon;

-- ───────────── RLS + sütun bazlı yetki ─────────────
alter table crm.collections enable row level security;
alter table crm.products enable row level security;
alter table crm.product_variants enable row level security;
alter table crm.customers enable row level security;
alter table crm.customer_stores enable row level security;
alter table crm.customer_assignments enable row level security;
alter table crm.customer_external_ids enable row level security;
alter table crm.customer_addresses enable row level security;
alter table crm.customer_notes enable row level security;
alter table crm.customer_interactions enable row level security;
alter table crm.store_visits enable row level security;
alter table crm.customer_product_interests enable row level security;
alter table crm.customer_merges enable row level security;
alter table crm.customer_consents enable row level security;
alter table crm.consent_events enable row level security;

-- Müşteri: hassas/hesaplanan sütunlar istemciden yazılamaz
revoke insert, update, delete on crm.customers from authenticated;
grant insert (organization_id, store_id, assigned_to, first_name, last_name, phone, email, source, birth_date, city, is_vip)
  on crm.customers to authenticated;
grant update (store_id, assigned_to, first_name, last_name, phone, email, source, birth_date, city, is_vip)
  on crm.customers to authenticated;
revoke insert, update, delete on crm.customer_stores, crm.customer_assignments, crm.customer_external_ids,
  crm.customer_merges, crm.consent_events from authenticated;

create policy cust_select on crm.customers for select to authenticated
  using ((select crm.has_perm('customers.read')) and crm.can_access_customer(id));
create policy cust_insert on crm.customers for insert to authenticated
  with check ((select crm.has_perm('customers.write')) and (select crm.can_access_store(store_id)));
create policy cust_update on crm.customers for update to authenticated
  using ((select crm.has_perm('customers.write')) and crm.can_access_customer(id) and status = 'active')
  with check ((select crm.has_perm('customers.write')) and (select crm.can_access_store(store_id)));

create policy cs_select on crm.customer_stores for select to authenticated
  using ((select crm.has_perm('customers.read')) and crm.can_access_customer(customer_id));
create policy ca_select on crm.customer_assignments for select to authenticated
  using ((select crm.has_perm('customers.read')) and crm.can_access_customer(customer_id));
create policy cx_select on crm.customer_external_ids for select to authenticated
  using ((select crm.has_perm('customers.read')) and crm.can_access_customer(customer_id));
create policy cm_select on crm.customer_merges for select to authenticated
  using ((select crm.has_perm('customers.merge')) and crm.can_access_customer(primary_id));
create policy ce_select on crm.consent_events for select to authenticated
  using ((select crm.has_perm('consents.read')) and crm.can_access_customer(customer_id));

-- Alt kayıtlar: oku = customers.read, yaz = customers.write; erişim müşteri erişimine bağlı
do $$
declare t text;
begin
  foreach t in array array['customer_addresses','customer_notes','customer_interactions','store_visits','customer_product_interests'] loop
    execute format('create policy %I on crm.%I for select to authenticated using ((select crm.has_perm(''customers.read'')) and crm.can_access_customer(customer_id))', t || '_sel', t);
    execute format('create policy %I on crm.%I for insert to authenticated with check ((select crm.has_perm(''customers.write'')) and crm.can_access_customer(customer_id))', t || '_ins', t);
    execute format('create policy %I on crm.%I for update to authenticated using ((select crm.has_perm(''customers.write'')) and crm.can_access_customer(customer_id)) with check ((select crm.has_perm(''customers.write'')) and crm.can_access_customer(customer_id))', t || '_upd', t);
    execute format('create policy %I on crm.%I for delete to authenticated using ((select crm.has_perm(''customers.write'')) and crm.can_access_customer(customer_id))', t || '_del', t);
  end loop;
end $$;

create policy consents_sel on crm.customer_consents for select to authenticated
  using ((select crm.has_perm('consents.read')) and crm.can_access_customer(customer_id));
create policy consents_ins on crm.customer_consents for insert to authenticated
  with check ((select crm.has_perm('consents.write')) and crm.can_access_customer(customer_id));
create policy consents_upd on crm.customer_consents for update to authenticated
  using ((select crm.has_perm('consents.write')) and crm.can_access_customer(customer_id))
  with check ((select crm.has_perm('consents.write')) and crm.can_access_customer(customer_id));

-- Ürün/koleksiyon
create policy coll_sel on crm.collections for select to authenticated using ((select crm.has_perm('products.read')));
create policy coll_w on crm.collections for all to authenticated
  using ((select crm.has_perm('products.write'))) with check ((select crm.has_perm('products.write')));
create policy prod_sel on crm.products for select to authenticated using ((select crm.has_perm('products.read')));
create policy prod_w on crm.products for all to authenticated
  using ((select crm.has_perm('products.write'))) with check ((select crm.has_perm('products.write')));
create policy var_sel on crm.product_variants for select to authenticated using ((select crm.has_perm('products.read')));
create policy var_w on crm.product_variants for all to authenticated
  using ((select crm.has_perm('products.write'))) with check ((select crm.has_perm('products.write')));
