-- CRM Aşama 7 + 9: segmentasyon, kampanya hedef kitlesi, şablonlar, VIP kuralı, satış sonrası hizmet

-- ───────── Segmentler ─────────
create table crm.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  rules jsonb not null default '{}',
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(rules) = 'object')
);
create trigger segments_updated before update on crm.segments for each row execute function crm.set_updated_at();

-- INVOKER: çağıranın RLS yetkisiyle çalışır; kimse göremediği müşteriyi segmente alamaz
create function crm.segment_query(p_rules jsonb) returns setof uuid
language sql stable security invoker set search_path = '' as $$
  select c.id from crm.customers c
  where c.status = 'active'
    and (p_rules->>'vip' is null or c.is_vip = (p_rules->>'vip')::boolean)
    and (p_rules->>'store_id' is null or c.store_id = (p_rules->>'store_id')::uuid)
    and (p_rules->>'assigned_to' is null or c.assigned_to = (p_rules->>'assigned_to')::uuid)
    and (p_rules->>'min_spent' is null or c.total_spent >= (p_rules->>'min_spent')::numeric)
    and (p_rules->>'max_spent' is null or c.total_spent <= (p_rules->>'max_spent')::numeric)
    and (p_rules->>'min_orders' is null or c.order_count >= (p_rules->>'min_orders')::int)
    and (p_rules->>'inactive_days' is null or c.last_purchase_at is null
         or c.last_purchase_at < now() - make_interval(days => (p_rules->>'inactive_days')::int))
    and (p_rules->>'registered_within_days' is null
         or c.registered_at >= now() - make_interval(days => (p_rules->>'registered_within_days')::int))
    and (p_rules->>'source' is null or c.source = p_rules->>'source')
    and (p_rules->>'city' is null or lower(c.city) = lower(p_rules->>'city'))
    and (p_rules->>'birthday_month' is null or extract(month from c.birth_date) = (p_rules->>'birthday_month')::int)
    and (p_rules->>'consent_channel' is null or exists (
          select 1 from crm.customer_consents k
          where k.customer_id = c.id and k.channel = p_rules->>'consent_channel'
            and k.purpose = 'marketing' and k.status = 'granted'))
$$;

create function crm.count_segment(p_rules jsonb) returns bigint
language sql stable security invoker set search_path = '' as $$
  select count(*) from crm.segment_query(p_rules)
$$;
revoke execute on function crm.segment_query(jsonb), crm.count_segment(jsonb) from public, anon;

-- ───────── Şablon / Kampanya ─────────
create table crm.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel text not null check (channel in ('sms','email','whatsapp')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger templates_updated before update on crm.message_templates for each row execute function crm.set_updated_at();

create table crm.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('sms','email','whatsapp')),
  segment_id uuid references crm.segments(id) on delete set null,
  template_id uuid references crm.message_templates(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','sending','done','cancelled')),
  scheduled_at timestamptz,
  prepared_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_updated before update on crm.campaigns for each row execute function crm.set_updated_at();

create table crm.campaign_recipients (
  campaign_id uuid not null references crm.campaigns(id) on delete cascade,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','delivered','failed','skipped_no_consent')),
  sent_at timestamptz,
  error text,
  primary key (campaign_id, customer_id)
);
create index campaign_recipients_customer_idx on crm.campaign_recipients (customer_id);

-- Hedef kitleyi dondurur: izni olmayan müşteri 'skipped_no_consent' olur, gönderime girmez
create function crm.prepare_campaign(p_campaign uuid) returns table (total bigint, eligible bigint, skipped bigint)
language plpgsql security invoker set search_path = '' as $$
declare v crm.campaigns; v_rules jsonb;
begin
  select * into v from crm.campaigns where id = p_campaign;
  if v.id is null then raise exception 'Kampanya bulunamadı'; end if;
  if v.status not in ('draft','ready') then raise exception 'Bu aşamada hedef kitle yenilenemez'; end if;
  if v.segment_id is null then raise exception 'Önce segment seçin'; end if;
  select rules into v_rules from crm.segments where id = v.segment_id;
  delete from crm.campaign_recipients where campaign_id = p_campaign;
  insert into crm.campaign_recipients (campaign_id, customer_id, status)
  select p_campaign, s, case when exists (
      select 1 from crm.customer_consents k
      where k.customer_id = s and k.channel = v.channel and k.purpose = 'marketing' and k.status = 'granted')
    then 'pending' else 'skipped_no_consent' end
  from crm.segment_query(coalesce(v_rules, '{}')) s;
  update crm.campaigns set prepared_at = now() where id = p_campaign;
  return query select count(*), count(*) filter (where status = 'pending'), count(*) filter (where status = 'skipped_no_consent')
               from crm.campaign_recipients where campaign_id = p_campaign;
end $$;
revoke execute on function crm.prepare_campaign(uuid) from public, anon;

create function crm.campaigns_before() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  if new.status = 'ready' and (new.prepared_at is null or new.template_id is null or new.segment_id is null) then
    raise exception 'Hazır olmak için segment, şablon ve hazırlanmış hedef kitle gerekir';
  end if;
  if new.template_id is not null and not exists (select 1 from crm.message_templates where id = new.template_id and channel = new.channel) then
    raise exception 'Şablon kanalı kampanya kanalıyla uyuşmuyor';
  end if;
  return new;
end $$;
create trigger campaigns_biu before insert or update on crm.campaigns for each row execute function crm.campaigns_before();

-- ───────── VIP kuralı ─────────
insert into crm.system_settings (key, value) values ('vip_rules', '{"min_spent": null}') on conflict do nothing;

create function crm.apply_vip_rules() returns int language plpgsql security definer set search_path = '' as $$
declare v_min numeric; n int;
begin
  if not crm.has_perm('vip.manage') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  select nullif(value->>'min_spent','')::numeric into v_min from crm.system_settings where key = 'vip_rules';
  if v_min is null or v_min <= 0 then raise exception 'VIP eşiği tanımlı değil'; end if;
  update crm.customers set is_vip = true
  where status = 'active' and not is_vip and total_spent >= v_min and crm.can_access_customer(id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function crm.apply_vip_rules() from public, anon;

-- ───────── Satış sonrası hizmet ─────────
create table crm.service_requests (
  id uuid primary key default gen_random_uuid(),
  req_no bigint generated always as identity unique,
  customer_id uuid not null references crm.customers(id) on delete cascade,
  store_id uuid not null references crm.stores(id) on delete restrict,
  type text not null check (type in ('maintenance','repair','warranty','exchange','return','other')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_customer','resolved','closed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  subject text not null,
  description text,
  product_id uuid references crm.products(id) on delete set null,
  order_id uuid references crm.orders(id) on delete set null,
  assigned_to uuid references crm.profiles(id) on delete set null,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sr_customer_idx on crm.service_requests (customer_id);
create index sr_store_status_idx on crm.service_requests (store_id, status);
create index sr_assigned_idx on crm.service_requests (assigned_to) where status in ('open','in_progress','waiting_customer');

create table crm.service_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references crm.service_requests(id) on delete cascade,
  kind text not null check (kind in ('note','status','assign')),
  body text,
  from_value text,
  to_value text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index sre_request_idx on crm.service_request_events (request_id, created_at);

create table crm.service_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references crm.service_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index sa_request_idx on crm.service_attachments (request_id);

create function crm.service_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.subject := btrim(new.subject);
  if new.subject = '' then raise exception 'Konu zorunlu'; end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.sla_due_at := coalesce(new.sla_due_at, now() + case new.priority when 'high' then interval '1 day' when 'low' then interval '7 days' else interval '3 days' end);
  end if;
  if new.status in ('resolved','closed') then new.resolved_at := coalesce(new.resolved_at, now()); else new.resolved_at := null; end if;
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (select 1 from crm.store_memberships where user_id = new.assigned_to and store_id = new.store_id) then
    raise exception 'Atanan kişi bu mağazaya bağlı değil';
  end if;
  return new;
end $$;
create trigger service_biu before insert or update on crm.service_requests for each row execute function crm.service_before();
create trigger service_updated before update on crm.service_requests for each row execute function crm.set_updated_at();

create function crm.service_after() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into crm.service_request_events (request_id, kind, from_value, to_value, user_id) values (new.id, 'status', old.status, new.status, auth.uid());
  end if;
  if tg_op = 'UPDATE' and old.assigned_to is distinct from new.assigned_to then
    insert into crm.service_request_events (request_id, kind, from_value, to_value, user_id) values (new.id, 'assign', old.assigned_to::text, new.assigned_to::text, auth.uid());
  end if;
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid() and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    perform crm.notify(new.assigned_to, 'service_assigned', 'Size servis talebi atandı: ' || new.subject, null, '/crm/servis', 'service-assigned-' || new.id || '-' || new.assigned_to);
  end if;
  return null;
end $$;
create trigger service_ai after insert or update on crm.service_requests for each row execute function crm.service_after();

create function crm.can_access_service(p_req uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select crm.is_super_admin() or exists (
    select 1 from crm.service_requests s
    where s.id = p_req and crm.is_active_user() and (
      s.assigned_to = auth.uid() or s.created_by = auth.uid()
      or (crm.my_scope() = 'stores' and s.store_id in (select crm.my_store_ids()))
      or crm.can_access_customer(s.customer_id)))
$$;
revoke execute on function crm.can_access_service(uuid) from public, anon;

create trigger audit_service after insert or update or delete on crm.service_requests for each row execute function crm.audit_trigger_min();
create trigger audit_segments after insert or update or delete on crm.segments for each row execute function crm.audit_trigger_min();
create trigger audit_campaigns after insert or update or delete on crm.campaigns for each row execute function crm.audit_trigger_min();

-- ───────── RLS ─────────
alter table crm.segments enable row level security;
alter table crm.message_templates enable row level security;
alter table crm.campaigns enable row level security;
alter table crm.campaign_recipients enable row level security;
alter table crm.service_requests enable row level security;
alter table crm.service_request_events enable row level security;
alter table crm.service_attachments enable row level security;

create policy seg_sel on crm.segments for select to authenticated using ((select crm.has_perm('segments.read')));
create policy seg_w on crm.segments for all to authenticated
  using ((select crm.has_perm('segments.write'))) with check ((select crm.has_perm('segments.write')));
create policy tpl_sel on crm.message_templates for select to authenticated using ((select crm.has_perm('campaigns.read')));
create policy tpl_w on crm.message_templates for all to authenticated
  using ((select crm.has_perm('campaigns.write'))) with check ((select crm.has_perm('campaigns.write')));
create policy camp_sel on crm.campaigns for select to authenticated using ((select crm.has_perm('campaigns.read')));
create policy camp_w on crm.campaigns for all to authenticated
  using ((select crm.has_perm('campaigns.write'))) with check ((select crm.has_perm('campaigns.write')));
-- alıcı kayıtları: yalnızca erişilebilen müşteriler görünür; yazma prepare_campaign (invoker) ile
create policy cr_sel on crm.campaign_recipients for select to authenticated
  using ((select crm.has_perm('campaigns.read')) and crm.can_access_customer(customer_id));
create policy cr_ins on crm.campaign_recipients for insert to authenticated
  with check ((select crm.has_perm('campaigns.write')) and crm.can_access_customer(customer_id));
create policy cr_del on crm.campaign_recipients for delete to authenticated using ((select crm.has_perm('campaigns.write')));
revoke update on crm.campaign_recipients from authenticated;

create policy sr_sel on crm.service_requests for select to authenticated
  using ((select crm.has_perm('service.read')) and (
    assigned_to = (select auth.uid()) or created_by = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or crm.can_access_customer(customer_id)));
create policy sr_ins on crm.service_requests for insert to authenticated
  with check ((select crm.has_perm('service.write')) and (select crm.can_access_store(store_id)) and crm.can_access_customer(customer_id));
create policy sr_upd on crm.service_requests for update to authenticated
  using ((select crm.has_perm('service.write')) and crm.can_access_service(id))
  with check ((select crm.has_perm('service.write')) and (select crm.can_access_store(store_id)));
create policy sre_sel on crm.service_request_events for select to authenticated
  using ((select crm.has_perm('service.read')) and crm.can_access_service(request_id));
create policy sre_ins on crm.service_request_events for insert to authenticated
  with check ((select crm.has_perm('service.write')) and kind = 'note' and crm.can_access_service(request_id));
revoke update, delete on crm.service_request_events from authenticated;
create policy sa_sel on crm.service_attachments for select to authenticated
  using ((select crm.has_perm('service.read')) and crm.can_access_service(request_id));
create policy sa_ins on crm.service_attachments for insert to authenticated
  with check ((select crm.has_perm('service.write')) and crm.can_access_service(request_id));
create policy sa_del on crm.service_attachments for delete to authenticated
  using ((select crm.has_perm('service.write')) and crm.can_access_service(request_id));

-- Dosya deposu (özel): yol = <talep_id>/<dosya>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crm-service', 'crm-service', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy crm_service_read on storage.objects for select to authenticated
  using (bucket_id = 'crm-service' and crm.can_access_service(((storage.foldername(name))[1])::uuid));
create policy crm_service_write on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-service' and crm.can_access_service(((storage.foldername(name))[1])::uuid));
create policy crm_service_delete on storage.objects for delete to authenticated
  using (bucket_id = 'crm-service' and crm.can_access_service(((storage.foldername(name))[1])::uuid));
