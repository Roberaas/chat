-- CRM Aşama 5: fırsatlar, teklifler, siparişler (ERP/POS kaynaklı)

create table crm.pipeline_stages (
  code text primary key,
  label text not null,
  position int not null unique,
  kind text not null check (kind in ('open','won','lost'))
);
insert into crm.pipeline_stages values
  ('new','Yeni talep',1,'open'),('first_contact','İlk iletişim',2,'open'),('interest','Ürün ilgisi',3,'open'),
  ('appointment','Randevu',4,'open'),('quote','Teklif',5,'open'),('follow_up','Takip',6,'open'),
  ('won','Kazanıldı',7,'won'),('lost','Kaybedildi',8,'lost');

create table crm.opportunities (
  id uuid primary key default gen_random_uuid(),
  opp_no bigint generated always as identity unique,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  store_id uuid not null references crm.stores(id) on delete restrict,
  owner_id uuid references crm.profiles(id) on delete set null,
  title text not null,
  stage text not null default 'new' references crm.pipeline_stages(code),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'TRY',
  expected_close_date date,
  next_follow_up_at timestamptz,
  lost_reason text,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opp_customer_idx on crm.opportunities (customer_id);
create index opp_store_stage_idx on crm.opportunities (store_id, stage);
create index opp_owner_idx on crm.opportunities (owner_id) where closed_at is null;
create index opp_follow_idx on crm.opportunities (next_follow_up_at) where closed_at is null;

create table crm.opportunity_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references crm.opportunities(id) on delete cascade,
  product_id uuid references crm.products(id) on delete set null,
  variant_id uuid references crm.product_variants(id) on delete set null,
  description text,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now()
);
create index opp_items_opp_idx on crm.opportunity_items (opportunity_id);

create table crm.opportunity_stage_history (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references crm.opportunities(id) on delete cascade,
  from_stage text, to_stage text not null,
  changed_by uuid, changed_at timestamptz not null default now()
);
create index opp_hist_opp_idx on crm.opportunity_stage_history (opportunity_id, changed_at);

create table crm.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_no bigint generated always as identity unique,
  opportunity_id uuid not null references crm.opportunities(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  total numeric(14,2) not null default 0,
  currency text not null default 'TRY',
  valid_until date,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotations_opp_idx on crm.quotations (opportunity_id);

-- Siparişler: ERP/POS/e-ticaret yetkili kaynaktır; (source_system, source_id) tekil
create table crm.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete restrict,
  store_id uuid references crm.stores(id) on delete set null,
  advisor_id uuid references crm.profiles(id) on delete set null,
  order_no text,
  status text not null default 'paid' check (status in ('pending','paid','shipped','delivered','cancelled','returned')),
  total numeric(14,2) not null default 0,
  currency text not null default 'TRY',
  ordered_at timestamptz not null default now(),
  source_system text not null default 'manual',
  source_id text,
  is_test boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index orders_source_uq on crm.orders (source_system, source_id) where source_id is not null;
create index orders_customer_idx on crm.orders (customer_id, ordered_at desc);
create index orders_store_idx on crm.orders (store_id, ordered_at desc);
create index orders_advisor_idx on crm.orders (advisor_id);

create table crm.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references crm.orders(id) on delete cascade,
  product_id uuid references crm.products(id) on delete set null,
  sku text, name text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0,
  source_id text
);
create index order_items_order_idx on crm.order_items (order_id);
create index order_items_product_idx on crm.order_items (product_id);

-- ───────── Tetikleyiciler ─────────
create function crm.opportunities_before() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_kind text;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.owner_id is null and auth.uid() is not null then new.owner_id := auth.uid(); end if;
  end if;
  select kind into v_kind from crm.pipeline_stages where code = new.stage;
  if v_kind = 'lost' and coalesce(btrim(new.lost_reason), '') = '' then
    raise exception 'Kaybedilen fırsat için neden zorunlu';
  end if;
  if v_kind in ('won','lost') then new.closed_at := coalesce(new.closed_at, now()); else new.closed_at := null; new.lost_reason := null; end if;
  return new;
end $$;
create trigger opportunities_biu before insert or update on crm.opportunities for each row execute function crm.opportunities_before();
create trigger opportunities_updated before update on crm.opportunities for each row execute function crm.set_updated_at();
create trigger quotations_updated before update on crm.quotations for each row execute function crm.set_updated_at();
create trigger orders_updated before update on crm.orders for each row execute function crm.set_updated_at();

create function crm.opportunities_after() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.stage is distinct from new.stage then
    insert into crm.opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage, auth.uid());
  end if;
  return null;
end $$;
create trigger opportunities_ai after insert or update on crm.opportunities for each row execute function crm.opportunities_after();

-- Fırsat tutarı kalemlerden hesaplanır (kalem varsa)
create function crm.sync_opp_amount() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(new.opportunity_id, old.opportunity_id);
begin
  if exists (select 1 from crm.opportunity_items where opportunity_id = v_id) then
    update crm.opportunities set amount = (select sum(quantity * unit_price) from crm.opportunity_items where opportunity_id = v_id)
    where id = v_id;
  end if;
  return null;
end $$;
create trigger opp_items_sync after insert or update or delete on crm.opportunity_items for each row execute function crm.sync_opp_amount();

-- Sipariş değişince müşteri istatistikleri
create function crm.orders_stats() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform crm.refresh_customer_stats(old.customer_id); end if;
  if tg_op in ('INSERT','UPDATE') then perform crm.refresh_customer_stats(new.customer_id); end if;
  return null;
end $$;
create trigger orders_stats_aiud after insert or update or delete on crm.orders for each row execute function crm.orders_stats();

create trigger audit_opportunities after insert or update or delete on crm.opportunities for each row execute function crm.audit_trigger_min();
create trigger audit_quotations after insert or update or delete on crm.quotations for each row execute function crm.audit_trigger_min();
create trigger audit_orders after insert or update or delete on crm.orders for each row execute function crm.audit_trigger_min();

-- ───────── Erişim ─────────
create function crm.can_access_opportunity(p_opp uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select crm.is_super_admin() or exists (
    select 1 from crm.opportunities o
    where o.id = p_opp and crm.is_active_user() and (
      o.owner_id = auth.uid()
      or (crm.my_scope() = 'stores' and o.store_id in (select crm.my_store_ids()))
      or crm.can_access_customer(o.customer_id)))
$$;

-- Aşama değişiminde sipariş bağlantısı: kazanılan fırsat için siparişi ERP getirir (otomatik sipariş uydurulmaz)
create function crm.move_opportunity(p_opp uuid, p_stage text, p_lost_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not crm.has_perm('opportunities.write') or not crm.can_access_opportunity(p_opp) then
    raise exception 'Yetkiniz yok' using errcode = '42501';
  end if;
  update crm.opportunities set stage = p_stage, lost_reason = p_lost_reason where id = p_opp;
end $$;
revoke execute on function crm.move_opportunity(uuid, text, text), crm.can_access_opportunity(uuid) from public, anon;

alter table crm.pipeline_stages enable row level security;
alter table crm.opportunities enable row level security;
alter table crm.opportunity_items enable row level security;
alter table crm.opportunity_stage_history enable row level security;
alter table crm.quotations enable row level security;
alter table crm.orders enable row level security;
alter table crm.order_items enable row level security;

revoke update on crm.opportunities from authenticated;
grant update (title, owner_id, amount, currency, expected_close_date, next_follow_up_at, stage, lost_reason, store_id) on crm.opportunities to authenticated;
revoke insert, update, delete on crm.opportunity_stage_history from authenticated;
-- Siparişler istemciden değiştirilemez: kaynak sistem/servis rolü yazar
revoke insert, update, delete on crm.orders, crm.order_items from authenticated;

create policy ps_sel on crm.pipeline_stages for select to authenticated using (true);

create policy opp_sel on crm.opportunities for select to authenticated
  using ((select crm.has_perm('opportunities.read')) and (
    owner_id = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or crm.can_access_customer(customer_id)));
create policy opp_ins on crm.opportunities for insert to authenticated
  with check ((select crm.has_perm('opportunities.write')) and (select crm.can_access_store(store_id)) and crm.can_access_customer(customer_id));
create policy opp_upd on crm.opportunities for update to authenticated
  using ((select crm.has_perm('opportunities.write')) and crm.can_access_opportunity(id))
  with check ((select crm.has_perm('opportunities.write')) and (select crm.can_access_store(store_id)));
create policy opp_del on crm.opportunities for delete to authenticated
  using ((select crm.is_super_admin()));

do $$
declare t text;
begin
  foreach t in array array['opportunity_items','quotations'] loop
    execute format('create policy %I on crm.%I for select to authenticated using ((select crm.has_perm(''opportunities.read'')) and crm.can_access_opportunity(opportunity_id))', t||'_sel', t);
    execute format('create policy %I on crm.%I for insert to authenticated with check ((select crm.has_perm(%L)) and crm.can_access_opportunity(opportunity_id))', t||'_ins', t, case when t='quotations' then 'quotations.write' else 'opportunities.write' end);
    execute format('create policy %I on crm.%I for update to authenticated using ((select crm.has_perm(%L)) and crm.can_access_opportunity(opportunity_id)) with check (crm.can_access_opportunity(opportunity_id))', t||'_upd', t, case when t='quotations' then 'quotations.write' else 'opportunities.write' end);
    execute format('create policy %I on crm.%I for delete to authenticated using ((select crm.has_perm(%L)) and crm.can_access_opportunity(opportunity_id))', t||'_del', t, case when t='quotations' then 'quotations.write' else 'opportunities.write' end);
  end loop;
end $$;
create policy osh_sel on crm.opportunity_stage_history for select to authenticated
  using ((select crm.has_perm('opportunities.read')) and crm.can_access_opportunity(opportunity_id));

create policy orders_sel on crm.orders for select to authenticated
  using ((select crm.has_perm('orders.read')) and crm.can_access_customer(customer_id));
create policy order_items_sel on crm.order_items for select to authenticated
  using ((select crm.has_perm('orders.read')) and exists (select 1 from crm.orders o where o.id = order_id and crm.can_access_customer(o.customer_id)));
