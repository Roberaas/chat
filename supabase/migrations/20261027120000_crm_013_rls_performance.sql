-- Performans: satır başına SECURITY DEFINER fonksiyon çağrısı yerine, istek başına bir kez
-- hesaplanan küme (initPlan) ve RLS'li ana tabloya yarı-birleşim kullanılır.
-- 100.000 müşteride sayım/liste sorgusu zaman aşımına uğruyordu (yük testiyle doğrulandı).

-- Bağlı müşteri kümeleri (RLS'siz tanımlayıcı; döngüsel RLS özyinelemesini önler)
create or replace function crm.my_linked_customer_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select cs.customer_id from crm.customer_stores cs
   where crm.my_scope() = 'stores' and cs.store_id in (select crm.my_store_ids())
  union
  select a.customer_id from crm.customer_assignments a
   where a.advisor_id = auth.uid() and a.ended_at is null and crm.is_active_user()
$$;
revoke all on function crm.my_linked_customer_ids() from public, anon;
grant execute on function crm.my_linked_customer_ids() to authenticated;

-- customers
alter policy cust_select on crm.customers using (
  (select crm.has_perm('customers.read')) and (
    (select crm.is_super_admin())
    or assigned_to = (select auth.uid())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or id in (select crm.my_linked_customer_ids())));

-- müşteriye bağlı alt tablolar
do $$
declare r record;
begin
  for r in select * from (values
    ('campaign_recipients','cr_sel','campaigns.read','customer_id'),
    ('consent_events','ce_select','consents.read','customer_id'),
    ('customer_addresses','customer_addresses_sel','customers.read','customer_id'),
    ('customer_assignments','ca_select','customers.read','customer_id'),
    ('customer_consents','consents_sel','consents.read','customer_id'),
    ('customer_external_ids','cx_select','customers.read','customer_id'),
    ('customer_interactions','customer_interactions_sel','customers.read','customer_id'),
    ('customer_merges','cm_select','customers.merge','primary_id'),
    ('customer_notes','customer_notes_sel','customers.read','customer_id'),
    ('customer_product_interests','customer_product_interests_sel','customers.read','customer_id'),
    ('customer_stores','cs_select','customers.read','customer_id'),
    ('store_visits','store_visits_sel','customers.read','customer_id')
  ) as t(tbl, pol, perm, col)
  loop
    execute format('alter policy %I on crm.%I using ((select crm.has_perm(%L)) and %I in (select id from crm.customers))', r.pol, r.tbl, r.perm, r.col);
  end loop;
end $$;

-- fırsat / randevu / sipariş / servis
alter policy opp_sel on crm.opportunities using (
  (select crm.has_perm('opportunities.read')) and (
    owner_id = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or customer_id in (select id from crm.customers)));
alter policy appt_sel on crm.appointments using (
  (select crm.has_perm('appointments.read')) and (
    advisor_id = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or customer_id in (select id from crm.customers)));
alter policy orders_sel on crm.orders using (
  (select crm.has_perm('orders.read')) and (
    advisor_id = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or customer_id in (select id from crm.customers)));
alter policy order_items_sel on crm.order_items using (
  (select crm.has_perm('orders.read')) and order_id in (select id from crm.orders));
alter policy sr_sel on crm.service_requests using (
  (select crm.has_perm('service.read')) and (
    assigned_to = (select auth.uid()) or created_by = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or customer_id in (select id from crm.customers)));
alter policy opportunity_items_sel on crm.opportunity_items using ((select crm.has_perm('opportunities.read')) and opportunity_id in (select id from crm.opportunities));
alter policy osh_sel on crm.opportunity_stage_history using ((select crm.has_perm('opportunities.read')) and opportunity_id in (select id from crm.opportunities));
alter policy quotations_sel on crm.quotations using ((select crm.has_perm('opportunities.read')) and opportunity_id in (select id from crm.opportunities));
alter policy sa_sel on crm.service_attachments using ((select crm.has_perm('service.read')) and request_id in (select id from crm.service_requests));
alter policy sre_sel on crm.service_request_events using ((select crm.has_perm('service.read')) and request_id in (select id from crm.service_requests));

-- Kapsanmayan yabancı anahtar indeksleri
create index if not exists appointments_opportunity_idx on crm.appointments(opportunity_id);
create index if not exists business_accounts_owner_idx on crm.business_accounts(owner_id);
create index if not exists business_opps_owner_idx on crm.business_opportunities(owner_id);
create index if not exists campaigns_segment_idx on crm.campaigns(segment_id);
create index if not exists campaigns_template_idx on crm.campaigns(template_id);
create index if not exists cust_interactions_store_idx on crm.customer_interactions(store_id);
create index if not exists cust_notes_author_idx on crm.customer_notes(author_id);
create index if not exists opp_items_product_idx on crm.opportunity_items(product_id);
create index if not exists opp_items_variant_idx on crm.opportunity_items(variant_id);
create index if not exists sr_order_idx on crm.service_requests(order_id);
create index if not exists sr_product_idx on crm.service_requests(product_id);
