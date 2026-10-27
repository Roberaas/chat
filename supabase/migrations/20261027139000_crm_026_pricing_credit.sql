-- Bayiye özel fiyat listeleri ve kredi limiti / cari bakiye
insert into crm.permissions (code, module, description) values
  ('pricing.read', 'b2b', 'Fiyat listelerini görüntüle'),
  ('pricing.manage', 'b2b', 'Fiyat listesi oluştur ve bayilere ata'),
  ('credit.read', 'b2b', 'Kredi limiti ve cari bakiyeyi görüntüle'),
  ('credit.manage', 'b2b', 'Kredi limiti belirle, tahsilat/düzeltme gir')
on conflict do nothing;
insert into crm.role_permissions (role_code, permission_code)
select r, p from (values
  ('super_admin','pricing.read'),('super_admin','pricing.manage'),('super_admin','credit.read'),('super_admin','credit.manage'),
  ('b2b_manager','pricing.read'),('b2b_manager','pricing.manage'),('b2b_manager','credit.read'),('b2b_manager','credit.manage'),
  ('executive','pricing.read'),('executive','credit.read'),
  ('dealer_admin','pricing.read'),('dealer_admin','credit.read'),
  ('dealer_user','pricing.read')
) as t(r, p) where exists (select 1 from crm.roles where code = r) on conflict do nothing;

create table crm.price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  currency text not null default 'TRY',
  discount_pct numeric(5,2) check (discount_pct is null or (discount_pct >= 0 and discount_pct <= 100)),
  valid_from date, valid_to date,
  is_active boolean not null default true,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create trigger price_lists_updated before update on crm.price_lists for each row execute function crm.set_updated_at();

create table crm.price_list_items (
  price_list_id uuid not null references crm.price_lists(id) on delete cascade,
  product_id uuid not null references crm.products(id) on delete cascade,
  price numeric(14,2) not null check (price >= 0),
  primary key (price_list_id, product_id)
);
create index price_list_items_product_idx on crm.price_list_items (product_id);

create table crm.store_price_list (
  store_id uuid primary key references crm.stores(id) on delete cascade,
  price_list_id uuid not null references crm.price_lists(id) on delete restrict
);
create index store_price_list_pl_idx on crm.store_price_list (price_list_id);

create table crm.store_credit (
  store_id uuid primary key references crm.stores(id) on delete cascade,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  payment_term_days int not null default 0 check (payment_term_days between 0 and 365),
  notify_pct int not null default 90 check (notify_pct between 1 and 100),
  last_alert_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger store_credit_updated before update on crm.store_credit for each row execute function crm.set_updated_at();

-- Cari hareketler: sipariş borç yazar (+), tahsilat/iade alacak yazar (-)
create table crm.store_ledger (
  id bigint generated always as identity primary key,
  store_id uuid not null references crm.stores(id) on delete cascade,
  entry_type text not null check (entry_type in ('order','payment','adjustment')),
  amount numeric(14,2) not null,
  order_id uuid references crm.orders(id) on delete set null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index store_ledger_order_uidx on crm.store_ledger (order_id) where entry_type = 'order';
create index store_ledger_store_idx on crm.store_ledger (store_id, created_at desc);

alter table crm.price_lists enable row level security;
alter table crm.price_list_items enable row level security;
alter table crm.store_price_list enable row level security;
alter table crm.store_credit enable row level security;
alter table crm.store_ledger enable row level security;
grant select, insert, update, delete on crm.price_lists, crm.price_list_items, crm.store_price_list, crm.store_credit to authenticated;
grant select, insert on crm.store_ledger to authenticated;

-- Bayi yalnız kendi mağazasına atanmış listeyi ve kalemlerini görür
create policy pl_sel on crm.price_lists for select to authenticated using (
  (select crm.has_perm('pricing.read')) and ((select crm.has_perm('pricing.manage')) or id in (select price_list_id from crm.store_price_list)));
create policy pl_w on crm.price_lists for all to authenticated using ((select crm.has_perm('pricing.manage'))) with check ((select crm.has_perm('pricing.manage')));
create policy pli_sel on crm.price_list_items for select to authenticated using (
  (select crm.has_perm('pricing.read')) and ((select crm.has_perm('pricing.manage')) or price_list_id in (select price_list_id from crm.store_price_list)));
create policy pli_w on crm.price_list_items for all to authenticated using ((select crm.has_perm('pricing.manage'))) with check ((select crm.has_perm('pricing.manage')));
create policy spl_sel on crm.store_price_list for select to authenticated using (
  (select crm.has_perm('pricing.read')) and (select crm.can_access_store(store_id)));
create policy spl_w on crm.store_price_list for all to authenticated using ((select crm.has_perm('pricing.manage'))) with check ((select crm.has_perm('pricing.manage')));
create policy sc_sel on crm.store_credit for select to authenticated using (
  (select crm.has_perm('credit.read')) and (select crm.can_access_store(store_id)));
create policy sc_w on crm.store_credit for all to authenticated using ((select crm.has_perm('credit.manage'))) with check ((select crm.has_perm('credit.manage')));
create policy sl_sel on crm.store_ledger for select to authenticated using (
  (select crm.has_perm('credit.read')) and (select crm.can_access_store(store_id)));
create policy sl_ins on crm.store_ledger for insert to authenticated with check (
  (select crm.has_perm('credit.manage')) and entry_type in ('payment','adjustment'));

create trigger audit_price_lists after insert or update or delete on crm.price_lists for each row execute function crm.audit_trigger_min();
create trigger audit_store_credit after insert or update or delete on crm.store_credit for each row execute function crm.audit_trigger_min();
create trigger audit_store_price_list after insert or update or delete on crm.store_price_list for each row execute function crm.audit_trigger_min();

-- Mağazanın geçerli fiyat listesinde ürün fiyatı (liste kalemi > liste iskontosu > ürün fiyatı)
create function crm.price_for(p_store uuid, p_product uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select i.price from crm.store_price_list s join crm.price_lists l on l.id = s.price_list_id and l.is_active
        and (l.valid_from is null or l.valid_from <= current_date) and (l.valid_to is null or l.valid_to >= current_date)
       join crm.price_list_items i on i.price_list_id = l.id and i.product_id = p_product
      where s.store_id = p_store),
    (select round(p.price * (1 - l.discount_pct / 100), 2) from crm.store_price_list s join crm.price_lists l on l.id = s.price_list_id and l.is_active
        and l.discount_pct is not null and (l.valid_from is null or l.valid_from <= current_date) and (l.valid_to is null or l.valid_to >= current_date)
       join crm.products p on p.id = p_product where s.store_id = p_store),
    (select price from crm.products where id = p_product))
  where (select crm.can_access_store(p_store)) and (select crm.has_perm('pricing.read'))
$$;

-- Bayi fiyatlı ürün listesi (çağıranın erişebildiği mağaza için)
create function crm.priced_products(p_store uuid) returns table (id uuid, sku text, name text, category text, list_price numeric, dealer_price numeric)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.sku, p.name, p.category, p.price, crm.price_for(p_store, p.id)
  from crm.products p where p.status = 'active' order by p.name
$$;

-- Cari özet: bakiye, limit, kullanım %
create function crm.credit_summary() returns table (store_id uuid, store_name text, store_code text, credit_limit numeric, balance numeric, available numeric, used_pct numeric, payment_term_days int, overdue numeric)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.name, s.code, coalesce(c.credit_limit, 0),
         coalesce(b.bal, 0), coalesce(c.credit_limit, 0) - coalesce(b.bal, 0),
         case when coalesce(c.credit_limit, 0) > 0 then round(coalesce(b.bal, 0) / c.credit_limit * 100, 1) end,
         coalesce(c.payment_term_days, 0),
         greatest(coalesce((select sum(l.amount) from crm.store_ledger l where l.store_id = s.id and l.entry_type = 'order'
                   and l.created_at < now() - make_interval(days => coalesce(c.payment_term_days, 0))), 0)
                  - coalesce((select sum(-l.amount) from crm.store_ledger l where l.store_id = s.id and l.entry_type <> 'order'), 0), 0)
  from crm.stores s
  left join crm.store_credit c on c.store_id = s.id
  left join lateral (select sum(amount) bal from crm.store_ledger where store_id = s.id) b on true
  where s.store_type in ('dealer','wholesale') and (select crm.has_perm('credit.read'))
  order by s.name
$$;
revoke execute on function crm.price_for(uuid, uuid), crm.priced_products(uuid), crm.credit_summary() from public, anon;
grant execute on function crm.price_for(uuid, uuid), crm.priced_products(uuid), crm.credit_summary() to authenticated;

-- Sipariş → cari hareket (bayi/toptancı mağazalar); iptal/iade bakiyeyi geri alır; limit aşımı bildirimi
create function crm.ledger_from_order() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text; v_limit numeric; v_notify int; v_bal numeric; v_uid uuid; v_name text; v_last timestamptz;
begin
  if new.is_test or new.store_id is null then return null; end if;
  select store_type, name into v_type, v_name from crm.stores where id = new.store_id;
  if v_type not in ('dealer','wholesale') then return null; end if;
  if new.status in ('cancelled','returned') then
    delete from crm.store_ledger where order_id = new.id and entry_type = 'order';
  else
    insert into crm.store_ledger (store_id, entry_type, amount, order_id, note, created_by)
    values (new.store_id, 'order', coalesce(new.total, 0), new.id, 'Sipariş ' || new.order_no, null)
    on conflict (order_id) where entry_type = 'order' do update set amount = excluded.amount, store_id = excluded.store_id;
  end if;
  select credit_limit, notify_pct, last_alert_at into v_limit, v_notify, v_last from crm.store_credit where store_id = new.store_id;
  if coalesce(v_limit, 0) > 0 then
    select coalesce(sum(amount), 0) into v_bal from crm.store_ledger where store_id = new.store_id;
    if v_bal >= v_limit * v_notify / 100.0 and (v_last is null or v_last < now() - interval '1 day') then
      update crm.store_credit set last_alert_at = now() where store_id = new.store_id;
      for v_uid in
        select distinct ur.user_id from crm.user_roles ur join crm.profiles p on p.id = ur.user_id and p.is_active
          left join crm.store_memberships sm on sm.user_id = ur.user_id
         where ur.role_code in ('super_admin','b2b_manager') or (ur.role_code = 'dealer_admin' and sm.store_id = new.store_id)
      loop
        insert into crm.notifications (user_id, type, title, body, link, dedupe_key)
        values (v_uid, 'credit', v_name || ': kredi limiti %' || round(v_bal / v_limit * 100) || ' dolu',
                'Bakiye ' || v_bal || ' / limit ' || v_limit, '/crm/cari', 'credit:' || new.store_id || ':' || current_date)
        on conflict do nothing;
      end loop;
    end if;
  end if;
  return null;
end $$;
create trigger orders_ledger after insert or update of total, status, store_id on crm.orders for each row execute function crm.ledger_from_order();
revoke execute on function crm.ledger_from_order() from public, anon, authenticated;

-- Tahsilat daima alacak (negatif) yazılır; düzeltme işaretiyle girilir
create function crm.ledger_sign() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.entry_type = 'payment' then new.amount := -abs(new.amount); end if;
  if new.amount = 0 then raise exception 'Tutar sıfır olamaz'; end if;
  return new;
end $$;
create trigger store_ledger_sign before insert on crm.store_ledger for each row execute function crm.ledger_sign();
revoke execute on function crm.ledger_sign() from public, anon, authenticated;
