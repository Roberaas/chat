-- Bayi/mağaza müşteri raporu: invoker fonksiyon, RLS gereği herkes yalnız kendi kapsamını görür.
create or replace function crm.dealer_report(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare res jsonb;
begin
  if not (select crm.has_perm('dashboard.read')) then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > interval '400 days' then raise exception 'Tarih aralığı geçersiz (en fazla 400 gün)'; end if;
  with
  cu as (select * from crm.customers where status = 'active' and (p_store is null or store_id = p_store)),
  od as (select * from crm.orders where not is_test and status in ('paid','shipped','delivered') and (p_store is null or store_id = p_store)),
  odr as (select * from od where ordered_at between p_from and p_to),
  buyers as (select customer_id, count(*) n, sum(total) rev, max(ordered_at) last_at from odr group by 1)
  select jsonb_build_object(
    'kpi', jsonb_build_object(
      'customers_total', (select count(*) from cu),
      'customers_new', (select count(*) from cu where registered_at between p_from and p_to),
      'vip', (select count(*) from cu where is_vip),
      'buyers', (select count(*) from buyers),
      'repeat_buyers', (select count(*) from buyers where n >= 2),
      'orders', (select count(*) from odr),
      'revenue', (select coalesce(sum(total), 0) from odr),
      'avg_basket', (select coalesce(round(avg(total)::numeric, 2), 0) from odr),
      'inactive_90', (select count(*) from cu where coalesce(last_purchase_at, registered_at) < now() - interval '90 days'),
      'never_bought', (select count(*) from cu where order_count = 0 and registered_at < now() - interval '30 days')
    ),
    'top_customers', (select coalesce(jsonb_agg(x order by (x->>'revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'name', btrim(c.first_name || ' ' || c.last_name), 'orders', b.n, 'revenue', b.rev, 'last_at', b.last_at) x
          from buyers b join cu c on c.id = b.customer_id order by b.rev desc limit 10) t),
    'inactive', (select coalesce(jsonb_agg(x order by (x->>'total_spent')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('id', c.id, 'name', btrim(c.first_name || ' ' || c.last_name), 'phone', c.phone, 'total_spent', c.total_spent, 'last_at', c.last_purchase_at) x
          from cu c where c.order_count > 0 and c.last_purchase_at < now() - interval '90 days' order by c.total_spent desc limit 10) t),
    'by_advisor', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'customers', a.customers, 'new', a.new, 'orders', a.orders, 'revenue', a.revenue) order by a.revenue desc), '[]'::jsonb) from (
        select p.id, btrim(p.first_name || ' ' || p.last_name) as name,
               (select count(*) from cu where cu.assigned_to = p.id) customers,
               (select count(*) from cu where cu.assigned_to = p.id and registered_at between p_from and p_to) new,
               (select count(*) from odr where odr.advisor_id = p.id) orders,
               (select coalesce(sum(total), 0) from odr where odr.advisor_id = p.id) revenue
          from crm.profiles p where p.is_active and exists (select 1 from cu where cu.assigned_to = p.id union all select 1 from odr where odr.advisor_id = p.id)) a),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'count', n) order by n desc), '[]'::jsonb)
                  from (select source, count(*) n from cu where registered_at between p_from and p_to group by 1) s),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('m', to_char(m, 'YYYY-MM'),
        'new', (select count(*) from cu where date_trunc('month', registered_at at time zone 'Europe/Istanbul') = m),
        'revenue', (select coalesce(sum(total), 0) from od where date_trunc('month', ordered_at at time zone 'Europe/Istanbul') = m)) order by m), '[]'::jsonb)
                  from generate_series(date_trunc('month', now() at time zone 'Europe/Istanbul') - interval '5 months', date_trunc('month', now() at time zone 'Europe/Istanbul'), interval '1 month') m)
  ) into res;
  return res;
end $$;
revoke all on function crm.dealer_report(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function crm.dealer_report(timestamptz, timestamptz, uuid) to authenticated;
