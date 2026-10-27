-- Raporlar (RLS kapsamlı), aktivite izleme, giriş geçmişi, duyurular, yönetici uyarıları, günlük özet

-- Giriş geçmişi
create table if not exists crm.login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references crm.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists login_events_user_idx on crm.login_events (user_id, created_at desc);
create index if not exists login_events_created_idx on crm.login_events (created_at desc);
alter table crm.login_events enable row level security;
create policy le_sel on crm.login_events for select to authenticated using ((select crm.has_perm('activity.read')));
grant select on crm.login_events to authenticated;

create or replace function crm.sync_last_sign_in() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update crm.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  if new.last_sign_in_at is distinct from old.last_sign_in_at and exists (select 1 from crm.profiles where id = new.id) then
    insert into crm.login_events (user_id, created_at) values (new.id, coalesce(new.last_sign_in_at, now()));
  end if;
  return new;
end $$;

-- Genel bakış raporu: çağıranın RLS kapsamında (süper admin hepsini, bayi yöneticisi yalnız kendi bayisini görür)
create or replace function crm.report_overview(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare res jsonb;
begin
  if not (select crm.has_perm('dashboard.read')) then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > interval '400 days' then raise exception 'Tarih aralığı geçersiz (en fazla 400 gün)'; end if;
  with
  cu as (select id, store_id, source, registered_at, created_by, assigned_to, is_vip from crm.customers where status = 'active' and (p_store is null or store_id = p_store)),
  op as (select * from crm.opportunities where (p_store is null or store_id = p_store)),
  od as (select * from crm.orders where not is_test and (p_store is null or store_id = p_store) and ordered_at between p_from and p_to),
  tk as (select * from crm.tasks where (p_store is null or store_id = p_store)),
  ap as (select * from crm.appointments where (p_store is null or store_id = p_store) and starts_at between p_from and p_to),
  sv as (select * from crm.service_requests where (p_store is null or store_id = p_store)),
  ix as (select * from crm.customer_interactions where (p_store is null or store_id = p_store) and occurred_at between p_from and p_to),
  days as (select d::date as d from generate_series((p_from at time zone 'Europe/Istanbul')::date, (p_to at time zone 'Europe/Istanbul')::date, interval '1 day') d)
  select jsonb_build_object(
    'kpi', jsonb_build_object(
      'customers_total', (select count(*) from cu),
      'customers_new', (select count(*) from cu where registered_at between p_from and p_to),
      'vip', (select count(*) from cu where is_vip),
      'opps_created', (select count(*) from op where created_at between p_from and p_to),
      'opps_won', (select count(*) from op where stage = 'won' and closed_at between p_from and p_to),
      'opps_won_amount', (select coalesce(sum(amount), 0) from op where stage = 'won' and closed_at between p_from and p_to),
      'opps_lost', (select count(*) from op where stage = 'lost' and closed_at between p_from and p_to),
      'pipeline_amount', (select coalesce(sum(amount), 0) from op where closed_at is null),
      'orders', (select count(*) from od),
      'orders_total', (select coalesce(sum(total), 0) from od),
      'tasks_done', (select count(*) from tk where status = 'done' and completed_at between p_from and p_to),
      'tasks_overdue', (select count(*) from tk where status in ('pending','in_progress') and due_at < now()),
      'appointments_completed', (select count(*) from ap where status = 'completed'),
      'appointments_no_show', (select count(*) from ap where status = 'no_show'),
      'interactions', (select count(*) from ix),
      'service_opened', (select count(*) from sv where created_at between p_from and p_to),
      'service_resolved', (select count(*) from sv where resolved_at between p_from and p_to),
      'service_overdue', (select count(*) from sv where status in ('open','in_progress','waiting_customer') and sla_due_at < now()),
      'service_avg_hours', (select round((avg(extract(epoch from resolved_at - created_at)) / 3600)::numeric, 1) from sv where resolved_at between p_from and p_to)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'd', d,
        'customers', (select count(*) from cu where (registered_at at time zone 'Europe/Istanbul')::date = days.d),
        'opps', (select count(*) from op where (created_at at time zone 'Europe/Istanbul')::date = days.d),
        'won', (select count(*) from op where stage = 'won' and (closed_at at time zone 'Europe/Istanbul')::date = days.d),
        'orders', (select count(*) from od where (ordered_at at time zone 'Europe/Istanbul')::date = days.d),
        'revenue', (select coalesce(sum(total), 0) from od where (ordered_at at time zone 'Europe/Istanbul')::date = days.d)
      ) order by d), '[]'::jsonb) from days),
    'by_store', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'type', s.store_type,
        'customers', (select count(*) from cu where cu.store_id = s.id),
        'new', (select count(*) from cu where cu.store_id = s.id and registered_at between p_from and p_to),
        'opps_created', (select count(*) from op where op.store_id = s.id and created_at between p_from and p_to),
        'won', (select count(*) from op where op.store_id = s.id and stage = 'won' and closed_at between p_from and p_to),
        'won_amount', (select coalesce(sum(amount), 0) from op where op.store_id = s.id and stage = 'won' and closed_at between p_from and p_to),
        'orders', (select count(*) from od where od.store_id = s.id),
        'revenue', (select coalesce(sum(total), 0) from od where od.store_id = s.id),
        'tasks_overdue', (select count(*) from tk where tk.store_id = s.id and status in ('pending','in_progress') and due_at < now())
      ) order by s.name), '[]'::jsonb) from crm.stores s where s.is_active and (p_store is null or s.id = p_store)),
    'by_user', case when (select crm.has_perm('reports.read')) then (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.first_name || ' ' || p.last_name,
        'roles', (select coalesce(string_agg(ur.role_code, ','), '') from crm.user_roles ur where ur.user_id = p.id),
        'stores', (select coalesce(string_agg(st.name, ', '), '') from crm.store_memberships sm join crm.stores st on st.id = sm.store_id where sm.user_id = p.id),
        'last_seen_at', p.last_seen_at,
        'customers_created', (select count(*) from cu where cu.created_by = p.id and registered_at between p_from and p_to),
        'interactions', (select count(*) from ix where ix.user_id = p.id),
        'opps_created', (select count(*) from op where op.created_by = p.id and created_at between p_from and p_to),
        'won', (select count(*) from op where op.owner_id = p.id and stage = 'won' and closed_at between p_from and p_to),
        'won_amount', (select coalesce(sum(amount), 0) from op where op.owner_id = p.id and stage = 'won' and closed_at between p_from and p_to),
        'tasks_done', (select count(*) from tk where tk.assignee_id = p.id and status = 'done' and completed_at between p_from and p_to),
        'tasks_overdue', (select count(*) from tk where tk.assignee_id = p.id and status in ('pending','in_progress') and due_at < now()),
        'appointments_completed', (select count(*) from ap where ap.advisor_id = p.id and status = 'completed'),
        'no_show', (select count(*) from ap where ap.advisor_id = p.id and status = 'no_show')
      ) order by p.first_name), '[]'::jsonb) from crm.profiles p where p.is_active) else '[]'::jsonb end,
    'funnel', (select coalesce(jsonb_agg(jsonb_build_object(
        'code', ps.code, 'label', ps.label, 'kind', ps.kind,
        'count', (select count(*) from op where op.stage = ps.code and (ps.kind = 'open' and op.closed_at is null or ps.kind <> 'open' and op.closed_at between p_from and p_to)),
        'amount', (select coalesce(sum(amount), 0) from op where op.stage = ps.code and (ps.kind = 'open' and op.closed_at is null or ps.kind <> 'open' and op.closed_at between p_from and p_to))
      ) order by ps.position), '[]'::jsonb) from crm.pipeline_stages ps),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'count', n) order by n desc), '[]'::jsonb)
                from (select source, count(*) n from cu where registered_at between p_from and p_to group by 1) x),
    'lost_reasons', (select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'count', n) order by n desc), '[]'::jsonb)
                from (select coalesce(nullif(lost_reason, ''), 'Belirtilmedi') reason, count(*) n from op where stage = 'lost' and closed_at between p_from and p_to group by 1 order by 2 desc limit 8) x)
  ) into res;
  return res;
end $$;
revoke all on function crm.report_overview(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function crm.report_overview(timestamptz, timestamptz, uuid) to authenticated;

-- Aktivite akışı: kim, ne zaman, neyi yaptı (yalnız activity.read / audit.read)
create or replace function crm.activity_feed(
  p_limit int default 100, p_before bigint default null, p_actor uuid default null, p_table text default null,
  p_store uuid default null, p_from timestamptz default null, p_to timestamptz default null)
returns table (id bigint, created_at timestamptz, actor_id uuid, actor_name text, actor_roles text, action text, table_name text,
               record_id text, store_id uuid, store_name text, changed text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (crm.has_perm('activity.read') or crm.has_perm('audit.read')) then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  return query
  select a.id, a.created_at, a.actor_id,
         coalesce(p.first_name || ' ' || p.last_name, 'Sistem'),
         (select string_agg(ur.role_code, ',') from crm.user_roles ur where ur.user_id = a.actor_id),
         a.action, a.table_name, a.record_id, a.store_id, s.name,
         case when a.new_data ? 'changed' then (select array_agg(k) from jsonb_array_elements_text(a.new_data -> 'changed') k) end
    from crm.audit_logs a
    left join crm.profiles p on p.id = a.actor_id
    left join crm.stores s on s.id = a.store_id
   where (p_before is null or a.id < p_before)
     and (p_actor is null or a.actor_id = p_actor)
     and (p_table is null or a.table_name = p_table)
     and (p_store is null or a.store_id = p_store)
     and (p_from is null or a.created_at >= p_from)
     and (p_to is null or a.created_at <= p_to)
     and a.table_name not in ('role_permissions')
   order by a.id desc
   limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function crm.activity_feed(int, bigint, uuid, text, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function crm.activity_feed(int, bigint, uuid, text, uuid, timestamptz, timestamptz) to authenticated;

-- Kullanıcı bazlı aktivite özeti
create or replace function crm.activity_users(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not crm.has_perm('activity.read') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.first_name || ' ' || p.last_name, 'email', p.email, 'active', p.is_active,
    'roles', (select coalesce(string_agg(ur.role_code, ','), '') from crm.user_roles ur where ur.user_id = p.id),
    'stores', (select coalesce(string_agg(st.name, ', '), '') from crm.store_memberships sm join crm.stores st on st.id = sm.store_id where sm.user_id = p.id),
    'last_sign_in_at', p.last_sign_in_at, 'last_seen_at', p.last_seen_at,
    'logins', (select count(*) from crm.login_events le where le.user_id = p.id and le.created_at between p_from and p_to),
    'actions', (select count(*) from crm.audit_logs a where a.actor_id = p.id and a.created_at between p_from and p_to),
    'creates', (select count(*) from crm.audit_logs a where a.actor_id = p.id and a.action = 'INSERT' and a.created_at between p_from and p_to),
    'updates', (select count(*) from crm.audit_logs a where a.actor_id = p.id and a.action = 'UPDATE' and a.created_at between p_from and p_to),
    'deletes', (select count(*) from crm.audit_logs a where a.actor_id = p.id and a.action = 'DELETE' and a.created_at between p_from and p_to),
    'exports', (select count(*) from crm.audit_logs a where a.actor_id = p.id and a.action = 'EXPORT' and a.created_at between p_from and p_to)
  ) order by p.first_name), '[]'::jsonb) from crm.profiles p);
end $$;
revoke all on function crm.activity_users(timestamptz, timestamptz) from public, anon;
grant execute on function crm.activity_users(timestamptz, timestamptz) to authenticated;

create or replace function crm.activity_logins(p_limit int default 100)
returns table (id bigint, created_at timestamptz, user_id uuid, user_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not crm.has_perm('activity.read') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  return query select le.id, le.created_at, le.user_id, p.first_name || ' ' || p.last_name
    from crm.login_events le join crm.profiles p on p.id = le.user_id order by le.id desc limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function crm.activity_logins(int) from public, anon;
grant execute on function crm.activity_logins(int) to authenticated;

-- Duyurular
create table if not exists crm.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 2000),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  audience_roles text[],
  audience_stores uuid[],
  sent_count int not null default 0,
  created_by uuid not null default auth.uid() references crm.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists announcements_created_idx on crm.announcements (created_at desc);
create index if not exists announcements_by_idx on crm.announcements (created_by);
alter table crm.announcements enable row level security;
create policy ann_sel on crm.announcements for select to authenticated using ((select crm.has_perm('announcements.manage')));
grant select on crm.announcements to authenticated;

create or replace function crm.send_announcement(p_title text, p_body text, p_severity text, p_roles text[], p_stores uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_id uuid; n int;
begin
  if auth.uid() is null or not crm.is_active_user() or not crm.has_perm('announcements.manage') then
    raise exception 'Duyuru gönderme yetkiniz yok' using errcode = '42501';
  end if;
  insert into crm.announcements (title, body, severity, audience_roles, audience_stores)
  values (btrim(p_title), btrim(p_body), coalesce(p_severity, 'info'),
          nullif(p_roles, '{}'), nullif(p_stores, '{}'))
  returning id into v_id;
  insert into crm.notifications (user_id, type, title, body, link, dedupe_key)
  select p.id, 'announcement', btrim(p_title), btrim(p_body), '/crm/bildirimler', 'ann:' || v_id
    from crm.profiles p
   where p.is_active
     and (p_roles is null or cardinality(p_roles) = 0 or exists (select 1 from crm.user_roles ur where ur.user_id = p.id and ur.role_code = any (p_roles)))
     and (p_stores is null or cardinality(p_stores) = 0 or exists (select 1 from crm.store_memberships sm where sm.user_id = p.id and sm.store_id = any (p_stores)))
  on conflict do nothing;
  get diagnostics n = row_count;
  update crm.announcements set sent_count = n where id = v_id;
  return n;
end $$;
revoke all on function crm.send_announcement(text, text, text, text[], uuid[]) from public, anon;
grant execute on function crm.send_announcement(text, text, text, text[], uuid[]) to authenticated;

-- Yönetici uyarıları
create or replace function crm.alert_admins(p_type text, p_title text, p_body text, p_link text, p_key text)
returns void language sql security definer set search_path = '' as $$
  insert into crm.notifications (user_id, type, title, body, link, dedupe_key)
  select ur.user_id, p_type, p_title, p_body, p_link, p_key
    from crm.user_roles ur join crm.profiles p on p.id = ur.user_id
   where ur.role_code = 'super_admin' and p.is_active
  on conflict do nothing
$$;
revoke all on function crm.alert_admins(text, text, text, text, text) from public, anon, authenticated;

create or replace function crm.alert_opportunity_won() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stage = 'won' and old.stage is distinct from 'won' then
    perform crm.alert_admins('opportunity_won', 'Fırsat kazanıldı',
      format('%s — %s %s', new.title, to_char(new.amount, 'FM999G999G990D00'), new.currency), '/crm/firsatlar', 'won:' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists alert_opp_won on crm.opportunities;
create trigger alert_opp_won after update of stage on crm.opportunities for each row execute function crm.alert_opportunity_won();

create or replace function crm.alert_service_high() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.priority = 'high' then
    perform crm.alert_admins('service_high', 'Yüksek öncelikli servis talebi', new.subject, '/crm/servis', 'svc:' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists alert_service_high on crm.service_requests;
create trigger alert_service_high after insert on crm.service_requests for each row execute function crm.alert_service_high();

create or replace function crm.alert_inbox_dead() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'dead' and old.status is distinct from 'dead' then
    perform crm.alert_admins('integration_error', 'Entegrasyon olayı işlenemedi', coalesce(new.error, 'Bilinmeyen hata'), '/crm/entegrasyonlar', 'inbox:' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists alert_inbox_dead on crm.webhook_inbox;
create trigger alert_inbox_dead after update of status on crm.webhook_inbox for each row execute function crm.alert_inbox_dead();

-- Günlük özet (süper adminlere, 08:30 İstanbul = 05:30 UTC)
create or replace function crm.daily_digest() returns void
language plpgsql security definer set search_path = '' as $$
declare v_from timestamptz := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul' - interval '1 day';
        v_to timestamptz := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
        v_body text;
begin
  select format('Dün: %s yeni müşteri, %s kazanılan fırsat (%s ₺), %s sipariş. Geciken görev: %s, geciken servis: %s.',
    (select count(*) from crm.customers where status = 'active' and registered_at >= v_from and registered_at < v_to),
    (select count(*) from crm.opportunities where stage = 'won' and closed_at >= v_from and closed_at < v_to),
    (select to_char(coalesce(sum(amount), 0), 'FM999G999G990') from crm.opportunities where stage = 'won' and closed_at >= v_from and closed_at < v_to),
    (select count(*) from crm.orders where not is_test and ordered_at >= v_from and ordered_at < v_to),
    (select count(*) from crm.tasks where status in ('pending','in_progress') and due_at < now()),
    (select count(*) from crm.service_requests where status in ('open','in_progress','waiting_customer') and sla_due_at < now()))
  into v_body;
  perform crm.alert_admins('digest', 'Günlük özet', v_body, '/crm/raporlar', 'digest:' || to_char(now() at time zone 'Europe/Istanbul', 'YYYY-MM-DD'));
end $$;
revoke all on function crm.daily_digest() from public, anon, authenticated;
select cron.schedule('crm_daily_digest', '30 5 * * *', $c$select crm.daily_digest()$c$);
