-- CRM Aşama 8: dashboard istatistikleri (INVOKER → çağıranın RLS yetkisiyle; yetkisiz veri sıfır/boş döner)
create function crm.dashboard_stats(p_from timestamptz, p_to timestamptz, p_store uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with
  cu as (select * from crm.customers where status = 'active' and (p_store is null or store_id = p_store)),
  op as (select * from crm.opportunities where (p_store is null or store_id = p_store)),
  won as (select count(*) n, coalesce(sum(amount),0) amt from op where stage = 'won' and closed_at between p_from and p_to),
  lost as (select count(*) n from op where stage = 'lost' and closed_at between p_from and p_to)
  select jsonb_build_object(
    'customers_total',   (select count(*) from cu),
    'customers_new',     (select count(*) from cu where registered_at between p_from and p_to),
    'vip_count',         (select count(*) from cu where is_vip),
    'opps_active',       (select count(*) from op where closed_at is null),
    'opps_pipeline_amount', (select coalesce(sum(amount),0) from op where closed_at is null),
    'opps_won',          (select n from won),
    'opps_won_amount',   (select amt from won),
    'opps_lost',         (select n from lost),
    'conversion_rate',   (select case when (select n from won) + (select n from lost) = 0 then null
                                 else round(100.0 * (select n from won) / ((select n from won) + (select n from lost)), 1) end),
    'tasks_open',        (select count(*) from crm.tasks where status in ('pending','in_progress') and (p_store is null or store_id = p_store)),
    'tasks_overdue',     (select count(*) from crm.tasks where status in ('pending','in_progress') and due_at < now() and (p_store is null or store_id = p_store)),
    'appointments_upcoming', (select count(*) from crm.appointments where status = 'scheduled' and starts_at between now() and now() + interval '7 days' and (p_store is null or store_id = p_store)),
    'service_open',      (select count(*) from crm.service_requests where status in ('open','in_progress','waiting_customer') and (p_store is null or store_id = p_store)),
    'service_overdue',   (select count(*) from crm.service_requests where status in ('open','in_progress','waiting_customer') and sla_due_at < now() and (p_store is null or store_id = p_store)),
    'per_store', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name,
        'customers', (select count(*) from crm.customers c where c.store_id = s.id and c.status = 'active'),
        'new', (select count(*) from crm.customers c where c.store_id = s.id and c.status = 'active' and c.registered_at between p_from and p_to),
        'vip', (select count(*) from crm.customers c where c.store_id = s.id and c.status = 'active' and c.is_vip),
        'opps_active', (select count(*) from crm.opportunities o where o.store_id = s.id and o.closed_at is null)
      ) order by s.name)
      from crm.stores s where s.is_active and (p_store is null or s.id = p_store)), '[]'::jsonb),
    'advisors', case when crm.has_perm('reports.read') then coalesce((
      select jsonb_agg(a order by (a->>'won_amount')::numeric desc) from (
        select jsonb_build_object(
          'id', p.id, 'name', p.first_name || ' ' || p.last_name,
          'customers', (select count(*) from cu where cu.assigned_to = p.id),
          'won', (select count(*) from op where op.owner_id = p.id and op.stage = 'won' and op.closed_at between p_from and p_to),
          'won_amount', (select coalesce(sum(amount),0) from op where op.owner_id = p.id and op.stage = 'won' and op.closed_at between p_from and p_to),
          'tasks_done', (select count(*) from crm.tasks t where t.assignee_id = p.id and t.status = 'done' and t.completed_at between p_from and p_to),
          'appointments_done', (select count(*) from crm.appointments ap where ap.advisor_id = p.id and ap.status = 'completed' and ap.starts_at between p_from and p_to)
        ) a
        from crm.profiles p
        where p.is_active and exists (select 1 from crm.user_roles ur where ur.user_id = p.id and ur.role_code = 'sales_advisor')
      ) x), '[]'::jsonb) else '[]'::jsonb end,
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'channel', c.channel, 'status', c.status,
        'total', (select count(*) from crm.campaign_recipients r where r.campaign_id = c.id),
        'eligible', (select count(*) from crm.campaign_recipients r where r.campaign_id = c.id and r.status <> 'skipped_no_consent'),
        'sent', (select count(*) from crm.campaign_recipients r where r.campaign_id = c.id and r.status in ('sent','delivered')),
        'failed', (select count(*) from crm.campaign_recipients r where r.campaign_id = c.id and r.status = 'failed')
      ) order by c.created_at desc)
      from crm.campaigns c where c.created_at between p_from and p_to), '[]'::jsonb)
  )
$$;
revoke execute on function crm.dashboard_stats(timestamptz, timestamptz, uuid) from public, anon;
