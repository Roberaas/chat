-- CRM Aşama 10-11: otomasyon kuyruğu ve entegrasyon altyapısı (canonical olay şeması v1)

-- ───────── Olay kuyruğu ve otomasyon ─────────
create table crm.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type text not null check (event_type in ('customer_created','opportunity_stage_changed','order_created','service_created','appointment_status_changed')),
  conditions jsonb not null default '{}' check (jsonb_typeof(conditions) = 'object'),
  action_type text not null check (action_type in ('create_task','notify_owner')),
  action_config jsonb not null default '{}' check (jsonb_typeof(action_config) = 'object'),
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger automation_rules_updated before update on crm.automation_rules for each row execute function crm.set_updated_at();

create table crm.event_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  entity_id uuid,
  customer_id uuid,
  store_id uuid,
  actor_id uuid,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','done','failed','dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index outbox_due_idx on crm.event_outbox (next_attempt_at) where status in ('pending','failed');

create table crm.job_executions (
  id bigint generated always as identity primary key,
  outbox_id bigint references crm.event_outbox(id) on delete cascade,
  rule_id uuid references crm.automation_rules(id) on delete set null,
  status text not null check (status in ('success','failed','skipped')),
  error text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index job_exec_outbox_idx on crm.job_executions (outbox_id);
create index job_exec_created_idx on crm.job_executions (created_at desc);

create function crm.emit_event(p_type text, p_entity uuid, p_customer uuid, p_store uuid, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into crm.event_outbox (event_type, entity_id, customer_id, store_id, actor_id, payload)
  values (p_type, p_entity, p_customer, p_store, auth.uid(), coalesce(p_payload, '{}'));
end $$;
revoke execute on function crm.emit_event(text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;

create function crm.ev_customer() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform crm.emit_event('customer_created', new.id, new.id, new.store_id, jsonb_build_object('source', new.source, 'is_vip', new.is_vip)); return null; end $$;
create trigger ev_customer_ai after insert on crm.customers for each row execute function crm.ev_customer();

create function crm.ev_opportunity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.stage is distinct from new.stage then
    perform crm.emit_event('opportunity_stage_changed', new.id, new.customer_id, new.store_id,
      jsonb_build_object('stage', new.stage, 'from', old.stage, 'title', new.title, 'owner_id', new.owner_id));
  end if;
  return null;
end $$;
create trigger ev_opportunity_au after update on crm.opportunities for each row execute function crm.ev_opportunity();

create function crm.ev_order() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform crm.emit_event('order_created', new.id, new.customer_id, new.store_id, jsonb_build_object('status', new.status, 'total', new.total, 'source_system', new.source_system)); return null; end $$;
create trigger ev_order_ai after insert on crm.orders for each row execute function crm.ev_order();

create function crm.ev_service() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform crm.emit_event('service_created', new.id, new.customer_id, new.store_id, jsonb_build_object('type', new.type, 'priority', new.priority, 'subject', new.subject)); return null; end $$;
create trigger ev_service_ai after insert on crm.service_requests for each row execute function crm.ev_service();

create function crm.ev_appointment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from new.status then
    perform crm.emit_event('appointment_status_changed', new.id, new.customer_id, new.store_id, jsonb_build_object('status', new.status, 'advisor_id', new.advisor_id));
  end if;
  return null;
end $$;
create trigger ev_appointment_au after update on crm.appointments for each row execute function crm.ev_appointment();

-- Kuyruk işleyici: her olay için eşleşen aktif kurallar çalışır; hata → yeniden dene (üstel bekleme), 5 denemede 'dead'
create function crm.process_outbox(p_limit int default 100) returns int
language plpgsql security definer set search_path = '' as $$
declare e record; r record; n int := 0; v_assignee uuid; v_cname text; v_failed boolean; v_err text; v_title text;
begin
  for e in select * from crm.event_outbox where status in ('pending','failed') and next_attempt_at <= now()
           order by id limit p_limit for update skip locked loop
    v_failed := false; v_err := null;
    select btrim(first_name || ' ' || last_name) into v_cname from crm.customers where id = e.customer_id;
    for r in select * from crm.automation_rules where is_active and event_type = e.event_type and e.payload @> conditions loop
      begin
        v_assignee := case r.action_config->>'assignee'
          when 'actor' then e.actor_id
          when 'opportunity_owner' then nullif(e.payload->>'owner_id','')::uuid
          else (select assigned_to from crm.customers where id = e.customer_id) end;
        v_title := replace(coalesce(r.action_config->>'title', r.name), '{{musteri}}', coalesce(v_cname, ''));
        if v_assignee is null then
          insert into crm.job_executions (outbox_id, rule_id, status, detail) values (e.id, r.id, 'skipped', jsonb_build_object('reason', 'atanacak kişi yok'));
        elsif r.action_type = 'create_task' then
          insert into crm.tasks (title, description, assignee_id, store_id, customer_id, due_at, created_by)
          values (v_title, 'Otomasyon: ' || r.name, v_assignee, e.store_id, e.customer_id,
                  now() + make_interval(hours => coalesce((r.action_config->>'due_in_hours')::int, 24)), null);
          insert into crm.job_executions (outbox_id, rule_id, status, detail) values (e.id, r.id, 'success', jsonb_build_object('action', 'create_task'));
        else
          perform crm.notify(v_assignee, 'automation', v_title, null, case when e.customer_id is not null then '/crm/musteriler/' || e.customer_id end, 'auto-' || r.id || '-' || e.id);
          insert into crm.job_executions (outbox_id, rule_id, status, detail) values (e.id, r.id, 'success', jsonb_build_object('action', 'notify_owner'));
        end if;
      exception when others then
        v_failed := true; v_err := sqlerrm;
        insert into crm.job_executions (outbox_id, rule_id, status, error) values (e.id, r.id, 'failed', sqlerrm);
      end;
    end loop;
    if v_failed then
      update crm.event_outbox set attempts = attempts + 1, last_error = v_err,
        status = case when attempts + 1 >= 5 then 'dead' else 'failed' end,
        next_attempt_at = now() + make_interval(mins => power(2, attempts + 1)::int) where id = e.id;
    else
      update crm.event_outbox set status = 'done', processed_at = now(), last_error = null where id = e.id;
    end if;
    n := n + 1;
  end loop;
  delete from crm.event_outbox where status = 'done' and processed_at < now() - interval '30 days';
  return n;
end $$;
revoke execute on function crm.process_outbox(int) from public, anon, authenticated;

create function crm.retry_event(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not crm.has_perm('settings.manage') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  update crm.event_outbox set status = 'pending', attempts = 0, next_attempt_at = now() where id = p_id and status in ('failed','dead');
end $$;
revoke execute on function crm.retry_event(bigint) from public, anon;

-- ───────── Entegrasyonlar ─────────
create table crm.integrations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{2,40}$'),
  kind text not null check (kind in ('erp','pos','ecommerce','sms','whatsapp','email','iys','other')),
  name text not null,
  status text not null default 'not_configured' check (status in ('not_configured','active','paused','error')),
  base_url text,
  secret_env text check (secret_env is null or secret_env ~ '^[A-Z][A-Z0-9_]{2,63}$'),  -- yalnızca ortam değişkeni ADI; gizli değer DB'ye yazılmaz
  config jsonb not null default '{}',
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger integrations_updated before update on crm.integrations for each row execute function crm.set_updated_at();

create table crm.webhook_inbox (
  id bigint generated always as identity primary key,
  integration_id uuid not null references crm.integrations(id) on delete cascade,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processed','failed','dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (integration_id, external_event_id)
);
create index inbox_due_idx on crm.webhook_inbox (next_attempt_at) where status in ('pending','failed');

create table crm.integration_mappings (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references crm.integrations(id) on delete cascade,
  entity text not null check (entity in ('customer','product','order')),
  source_field text not null,
  target_field text not null,
  unique (integration_id, entity, target_field)
);

create table crm.sync_runs (
  id bigint generated always as identity primary key,
  integration_id uuid not null references crm.integrations(id) on delete cascade,
  kind text not null,
  status text not null check (status in ('running','success','partial','failed')),
  records_in int not null default 0,
  records_ok int not null default 0,
  records_failed int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sync_runs_integration_idx on crm.sync_runs (integration_id, started_at desc);

-- Canonical olaylar: product.upsert, order.upsert. ERP/POS yetkili kaynaktır: gelen değer CRM'dekini ezer.
create function crm.process_inbox(p_limit int default 100) returns int
language plpgsql security definer set search_path = '' as $$
declare m record; ig record; d jsonb; n int := 0; v_cust uuid; v_store uuid; v_order uuid; v_org uuid; v_phone text; v_email text; v_coll uuid; v_adv uuid; it jsonb; v_prod uuid; ok int; bad int;
begin
  select id into v_org from crm.organizations limit 1;
  for m in select * from crm.webhook_inbox where status in ('pending','failed') and next_attempt_at <= now() order by id limit p_limit for update skip locked loop
    select * into ig from crm.integrations where id = m.integration_id;
    begin
      d := m.payload->'data';
      if m.event_type = 'product.upsert' then
        v_coll := null;
        if d->>'collection_code' is not null then
          insert into crm.collections (code, name, source_system, source_id, synced_at)
          values (upper(d->>'collection_code'), coalesce(d->>'collection_name', d->>'collection_code'), ig.code, upper(d->>'collection_code'), now())
          on conflict (code) do update set synced_at = now() returning id into v_coll;
        end if;
        insert into crm.products (sku, name, collection_id, category, material, price, currency, status, source_system, source_id, synced_at)
        values (d->>'sku', d->>'name', v_coll, d->>'category', d->>'material', nullif(d->>'price','')::numeric, coalesce(d->>'currency','TRY'),
                coalesce(d->>'status','active'), ig.code, coalesce(d->>'source_id', d->>'sku'), now())
        on conflict (source_system, source_id) where source_system is not null do update set
          name = excluded.name, collection_id = excluded.collection_id, category = excluded.category, material = excluded.material,
          price = excluded.price, currency = excluded.currency, status = excluded.status, sku = excluded.sku, synced_at = now();
      elsif m.event_type = 'order.upsert' then
        v_phone := crm.norm_phone(d#>>'{customer,phone}'); v_email := crm.norm_email(d#>>'{customer,email}');
        v_cust := (select customer_id from crm.customer_external_ids where source_system = ig.code and external_id = d#>>'{customer,source_id}');
        if v_cust is null and v_phone is not null then v_cust := (select id from crm.customers where organization_id = v_org and status = 'active' and phone_norm = v_phone); end if;
        if v_cust is null and v_email is not null then v_cust := (select id from crm.customers where organization_id = v_org and status = 'active' and email_norm = v_email); end if;
        v_store := (select id from crm.stores where code = upper(d->>'store_code'));
        if v_cust is null then
          if v_phone is null and v_email is null then raise exception 'Müşteri tanımlanamadı (telefon/e-posta yok)'; end if;
          v_store := coalesce(v_store, (select id from crm.stores where store_type = case when ig.kind = 'ecommerce' then 'online' else 'hq' end and is_active limit 1));
          if v_store is null then raise exception 'Mağaza bulunamadı'; end if;
          insert into crm.customers (organization_id, store_id, first_name, last_name, phone, email, source)
          values (v_org, v_store, coalesce(nullif(d#>>'{customer,first_name}',''), 'Müşteri'), coalesce(d#>>'{customer,last_name}',''), d#>>'{customer,phone}', d#>>'{customer,email}',
                  case when ig.kind = 'ecommerce' then 'ecommerce' else 'walk_in' end) returning id into v_cust;
        end if;
        if d#>>'{customer,source_id}' is not null then
          insert into crm.customer_external_ids (customer_id, source_system, external_id) values (v_cust, ig.code, d#>>'{customer,source_id}') on conflict do nothing;
        end if;
        v_adv := (select p.id from crm.profiles p where p.email = lower(d->>'advisor_email'));
        insert into crm.orders (customer_id, store_id, advisor_id, order_no, status, total, currency, ordered_at, source_system, source_id, synced_at)
        values (v_cust, v_store, v_adv, d->>'order_no', coalesce(d->>'status','paid'), coalesce((d->>'total')::numeric, 0), coalesce(d->>'currency','TRY'),
                coalesce((d->>'ordered_at')::timestamptz, now()), ig.code, d->>'source_id', now())
        on conflict (source_system, source_id) where source_id is not null do update set
          status = excluded.status, total = excluded.total, currency = excluded.currency, order_no = excluded.order_no,
          store_id = coalesce(excluded.store_id, crm.orders.store_id), advisor_id = coalesce(excluded.advisor_id, crm.orders.advisor_id), synced_at = now()
        returning id into v_order;
        delete from crm.order_items where order_id = v_order;
        for it in select * from jsonb_array_elements(coalesce(d->'items', '[]')) loop
          v_prod := (select id from crm.products where sku = it->>'sku');
          insert into crm.order_items (order_id, product_id, sku, name, quantity, unit_price, source_id)
          values (v_order, v_prod, it->>'sku', coalesce(it->>'name', it->>'sku', 'Ürün'), coalesce((it->>'quantity')::int, 1), coalesce((it->>'unit_price')::numeric, 0), it->>'source_id');
        end loop;
      else
        raise exception 'Bilinmeyen olay türü: %', m.event_type;
      end if;
      update crm.webhook_inbox set status = 'processed', processed_at = now(), error = null where id = m.id;
      update crm.integrations set last_success_at = now(), last_error = null, status = case when status = 'error' then 'active' else status end where id = ig.id;
    exception when others then
      update crm.webhook_inbox set attempts = attempts + 1, error = sqlerrm,
        status = case when attempts + 1 >= 5 then 'dead' else 'failed' end,
        next_attempt_at = now() + make_interval(mins => power(2, attempts + 1)::int) where id = m.id;
      update crm.integrations set last_error = sqlerrm where id = ig.id;
    end;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function crm.process_inbox(int) from public, anon, authenticated;

create function crm.retry_inbox(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not crm.has_perm('integrations.manage') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  update crm.webhook_inbox set status = 'pending', attempts = 0, next_attempt_at = now() where id = p_id and status in ('failed','dead');
end $$;
revoke execute on function crm.retry_inbox(bigint) from public, anon;

-- ───────── RLS ─────────
alter table crm.automation_rules enable row level security;
alter table crm.event_outbox enable row level security;
alter table crm.job_executions enable row level security;
alter table crm.integrations enable row level security;
alter table crm.webhook_inbox enable row level security;
alter table crm.integration_mappings enable row level security;
alter table crm.sync_runs enable row level security;

create policy ar_all on crm.automation_rules for all to authenticated
  using ((select crm.has_perm('settings.manage'))) with check ((select crm.has_perm('settings.manage')));
create policy ob_sel on crm.event_outbox for select to authenticated using ((select crm.has_perm('settings.manage')));
create policy je_sel on crm.job_executions for select to authenticated using ((select crm.has_perm('settings.manage')));
revoke insert, update, delete on crm.event_outbox, crm.job_executions, crm.webhook_inbox, crm.sync_runs from authenticated;

create policy int_all on crm.integrations for all to authenticated
  using ((select crm.has_perm('integrations.manage'))) with check ((select crm.has_perm('integrations.manage')));
create policy inbox_sel on crm.webhook_inbox for select to authenticated using ((select crm.has_perm('integrations.manage')));
create policy map_all on crm.integration_mappings for all to authenticated
  using ((select crm.has_perm('integrations.manage'))) with check ((select crm.has_perm('integrations.manage')));
create policy sync_sel on crm.sync_runs for select to authenticated using ((select crm.has_perm('integrations.manage')));

create trigger audit_automation_rules after insert or update or delete on crm.automation_rules for each row execute function crm.audit_trigger_min();
create trigger audit_integrations after insert or update or delete on crm.integrations for each row execute function crm.audit_trigger_min();

select cron.schedule('crm_process_queues', '* * * * *', $cron$select crm.process_outbox(); select crm.process_inbox();$cron$);
