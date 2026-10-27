-- Genel arama, özel günler, RFM müşteri analizi, satış hedefleri, mükerrer tespiti, doğum günü bildirimi

-- ── Genel arama (RLS'li: kullanıcı yalnız görebildiğini bulur) ──
create function crm.global_search(p_q text) returns table(kind text, id text, title text, sub text, link text)
language plpgsql stable set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_q, '')));
begin
  if length(q) < 2 then return; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  (select 'customer', c.id::text, btrim(c.first_name || ' ' || c.last_name), coalesce(c.phone, c.email, ''), '/crm/musteriler/' || c.id
     from crm.customers c where c.status = 'active' and c.search_text like '%' || q || '%' order by c.last_purchase_at desc nulls last limit 6)
  union all
  (select 'order', o.id::text, coalesce(o.order_no, o.id::text), to_char(o.total, 'FM999G999G990') || ' ' || o.currency, '/crm/siparisler?q=' || coalesce(o.order_no, '')
     from crm.orders o where lower(coalesce(o.order_no, '')) like '%' || q || '%' order by o.ordered_at desc limit 4)
  union all
  (select 'product', p.id::text, p.name, coalesce(p.sku, ''), '/crm/urunler'
     from crm.products p where lower(p.name) like '%' || q || '%' or lower(coalesce(p.sku, '')) like '%' || q || '%' limit 4)
  union all
  (select 'opportunity', op.id::text, op.title, op.stage, '/crm/musteriler/' || op.customer_id
     from crm.opportunities op where lower(op.title) like '%' || q || '%' order by op.created_at desc limit 4)
  union all
  (select 'b2b', b.id::text, b.name, b.type, '/crm/b2b'
     from crm.business_accounts b where lower(b.name) like '%' || q || '%' limit 3);
end $$;
revoke all on function crm.global_search(text) from public, anon;
grant execute on function crm.global_search(text) to authenticated;

-- ── Özel günler (doğum günü) ──
create function crm.special_days(p_days int default 14)
returns table(customer_id uuid, name text, phone text, birth_date date, next_date date, days_left int, turning int, assigned_to uuid, advisor_name text, store_id uuid, store_name text)
language sql stable set search_path = '' as $$
  with t as (select (now() at time zone 'Europe/Istanbul')::date today),
  b as (
    select c.*, t.today,
      (c.birth_date + make_interval(years => extract(year from t.today)::int - extract(year from c.birth_date)::int))::date as d0
    from crm.customers c, t where c.status = 'active' and c.birth_date is not null),
  n as (
    select b.*, case when b.d0 >= b.today then b.d0
      else (b.birth_date + make_interval(years => extract(year from b.today)::int - extract(year from b.birth_date)::int + 1))::date end as nd
    from b)
  select n.id, btrim(n.first_name || ' ' || n.last_name), n.phone, n.birth_date, n.nd, (n.nd - n.today)::int,
         extract(year from n.nd)::int - extract(year from n.birth_date)::int,
         n.assigned_to, (select btrim(p.first_name || ' ' || p.last_name) from crm.profiles p where p.id = n.assigned_to),
         n.store_id, (select s.name from crm.stores s where s.id = n.store_id)
    from n where n.nd <= n.today + least(greatest(p_days, 0), 366) order by n.nd, 2
$$;
revoke all on function crm.special_days(int) from public, anon;
grant execute on function crm.special_days(int) to authenticated;

-- ── RFM: yenilik (R), sıklık (F), parasal değer (M) ──
create function crm._rfm(p_store uuid)
returns table(id uuid, name text, phone text, city text, order_count int, total_spent numeric, last_purchase_at timestamptz, r int, f int, m int, segment text)
language sql stable set search_path = '' as $$
  with b as (
    select c.id, btrim(c.first_name || ' ' || c.last_name) as name, c.phone, c.city, c.order_count, c.total_spent, c.last_purchase_at,
           ntile(5) over (order by c.last_purchase_at nulls first) as r,
           case when c.order_count >= 5 then 5 when c.order_count >= 3 then 4 when c.order_count = 2 then 3 else 1 end as f,
           ntile(5) over (order by c.total_spent) as m
      from crm.customers c where c.status = 'active' and c.order_count > 0 and (p_store is null or c.store_id = p_store))
  select b.id, b.name, b.phone, b.city, b.order_count, b.total_spent, b.last_purchase_at, b.r, b.f, b.m,
         case when b.r >= 4 and b.f >= 4 and b.m >= 4 then 'Şampiyon'
              when b.f >= 4 and b.r >= 3 then 'Sadık'
              when b.order_count = 1 and b.r >= 4 then 'Yeni'
              when b.r >= 4 and b.f >= 3 then 'Potansiyel sadık'
              when b.r <= 2 and b.f >= 3 then 'Risk altında'
              when b.r <= 2 then 'Uyuyan'
              else 'Aktif' end
    from b
  union all
  select c.id, btrim(c.first_name || ' ' || c.last_name), c.phone, c.city, 0, 0::numeric, null::timestamptz, 0, 0, 0, 'Hiç alışveriş yok'
    from crm.customers c where c.status = 'active' and c.order_count = 0 and (p_store is null or c.store_id = p_store)
$$;
create function crm.rfm_summary(p_store uuid default null)
returns table(segment text, customers bigint, total_spent numeric, avg_spent numeric)
language sql stable set search_path = '' as $$
  select segment, count(*), coalesce(sum(total_spent), 0), coalesce(round(avg(total_spent), 2), 0) from crm._rfm(p_store) group by segment
$$;
create function crm.rfm_customers(p_store uuid default null, p_segment text default null, p_limit int default 200)
returns table(id uuid, name text, phone text, city text, order_count int, total_spent numeric, last_purchase_at timestamptz, segment text)
language sql stable set search_path = '' as $$
  select id, name, phone, city, order_count, total_spent, last_purchase_at, segment from crm._rfm(p_store)
   where p_segment is null or segment = p_segment order by total_spent desc, name limit least(greatest(p_limit, 1), 1000)
$$;
revoke all on function crm._rfm(uuid), crm.rfm_summary(uuid), crm.rfm_customers(uuid, text, int) from public, anon;
grant execute on function crm._rfm(uuid), crm.rfm_summary(uuid), crm.rfm_customers(uuid, text, int) to authenticated;

-- ── Mükerrer kayıt adayları (aynı ad-soyad) ──
create function crm.find_duplicates(p_limit int default 100)
returns table(a_id uuid, b_id uuid, a_name text, b_name text, a_phone text, b_phone text, a_email text, b_email text, a_store text, b_store text, a_orders int, b_orders int)
language sql stable set search_path = '' as $$
  select a.id, b.id, btrim(a.first_name || ' ' || a.last_name), btrim(b.first_name || ' ' || b.last_name), a.phone, b.phone, a.email, b.email,
         (select s.name from crm.stores s where s.id = a.store_id), (select s.name from crm.stores s where s.id = b.store_id), a.order_count, b.order_count
    from crm.customers a join crm.customers b
      on lower(btrim(a.first_name)) = lower(btrim(b.first_name)) and lower(btrim(a.last_name)) = lower(btrim(b.last_name)) and a.id < b.id
   where a.status = 'active' and b.status = 'active' and btrim(a.last_name) <> ''
   order by 3 limit least(greatest(p_limit, 1), 500)
$$;
revoke all on function crm.find_duplicates(int) from public, anon;
grant execute on function crm.find_duplicates(int) to authenticated;

-- ── Satış hedefleri ──
insert into crm.permissions (code, module, description) values
  ('targets.read', 'reports', 'Satış hedeflerini görüntüle'),
  ('targets.manage', 'reports', 'Satış hedefi belirle')
on conflict do nothing;
insert into crm.role_permissions (role_code, permission_code)
select r, p from (values
  ('super_admin','targets.read'),('super_admin','targets.manage'),
  ('executive','targets.read'),('executive','targets.manage'),
  ('store_manager','targets.read'),('store_manager','targets.manage'),
  ('sales_advisor','targets.read'),
  ('dealer_admin','targets.read'),('dealer_admin','targets.manage'),
  ('dealer_user','targets.read')
) as t(r, p)
where exists (select 1 from crm.roles where code = r)
on conflict do nothing;

create table crm.sales_targets (
  id uuid primary key default gen_random_uuid(),
  period date not null check (period = date_trunc('month', period)::date),
  store_id uuid references crm.stores(id) on delete cascade,
  advisor_id uuid references crm.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (store_id is not null or advisor_id is not null)
);
create unique index sales_targets_uq on crm.sales_targets (period, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(advisor_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index sales_targets_store_idx on crm.sales_targets (store_id);
create index sales_targets_advisor_idx on crm.sales_targets (advisor_id);
create trigger sales_targets_updated before update on crm.sales_targets for each row execute function crm.set_updated_at();
create trigger audit_sales_targets after insert or update or delete on crm.sales_targets for each row execute function crm.audit_trigger();
alter table crm.sales_targets enable row level security;
grant select, insert, update, delete on crm.sales_targets to authenticated;
create policy st_sel on crm.sales_targets for select to authenticated using (
  (select crm.has_perm('targets.read')) and (
    (select crm.is_super_admin()) or advisor_id = (select auth.uid())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))));
create policy st_ins on crm.sales_targets for insert to authenticated with check (
  (select crm.has_perm('targets.manage')) and ((select crm.is_super_admin()) or store_id in (select crm.my_store_ids())));
create policy st_upd on crm.sales_targets for update to authenticated
  using ((select crm.has_perm('targets.manage')) and ((select crm.is_super_admin()) or store_id in (select crm.my_store_ids())))
  with check ((select crm.has_perm('targets.manage')) and ((select crm.is_super_admin()) or store_id in (select crm.my_store_ids())));
create policy st_del on crm.sales_targets for delete to authenticated using (
  (select crm.has_perm('targets.manage')) and ((select crm.is_super_admin()) or store_id in (select crm.my_store_ids())));

create function crm.target_progress(p_period date default null)
returns table(id uuid, period date, store_id uuid, store_name text, advisor_id uuid, advisor_name text, target numeric, actual numeric)
language sql stable set search_path = '' as $$
  select t.id, t.period, t.store_id, s.name, t.advisor_id, btrim(p.first_name || ' ' || p.last_name), t.amount,
         coalesce((select sum(o.total) from crm.orders o
                    where o.status in ('paid','shipped','delivered') and not o.is_test
                      and o.ordered_at >= t.period and o.ordered_at < (t.period + interval '1 month')
                      and (t.store_id is null or o.store_id = t.store_id) and (t.advisor_id is null or o.advisor_id = t.advisor_id)), 0)
    from crm.sales_targets t
    left join crm.stores s on s.id = t.store_id left join crm.profiles p on p.id = t.advisor_id
   where t.period = date_trunc('month', coalesce(p_period, (now() at time zone 'Europe/Istanbul')::date))::date
   order by s.name nulls last, 6
$$;
revoke all on function crm.target_progress(date) from public, anon;
grant execute on function crm.target_progress(date) to authenticated;

-- ── Doğum günü bildirimi (her gün 08:40 TR) ──
create function crm.birthday_notifications() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; v_to uuid;
begin
  for r in select * from crm.special_days(3) loop
    v_to := coalesce(r.assigned_to, (select s.manager_id from crm.stores s where s.id = r.store_id));
    if v_to is not null then
      perform crm.notify(v_to, 'birthday',
        case when r.days_left = 0 then 'Bugün doğum günü: ' || r.name else 'Doğum günü yaklaşıyor: ' || r.name end,
        case when r.days_left = 0 then r.turning || ' yaşına giriyor. Tebrik mesajı gönderin.' else r.days_left || ' gün sonra ' || r.turning || ' yaşına girecek.' end,
        '/crm/musteriler/' || r.customer_id, 'bday-' || r.customer_id || '-' || extract(year from r.next_date)::int || '-' || r.days_left);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function crm.birthday_notifications() from public, anon, authenticated;
select cron.schedule('crm_birthday_notifications', '40 5 * * *', $c$select crm.birthday_notifications()$c$);
