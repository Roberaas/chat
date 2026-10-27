-- CRM Aşama 6: görevler, randevular, bildirimler

create extension if not exists btree_gist with schema extensions;

create table crm.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  assignee_id uuid references crm.profiles(id) on delete set null,
  store_id uuid references crm.stores(id) on delete set null,
  customer_id uuid references crm.customers(id) on delete cascade,
  opportunity_id uuid references crm.opportunities(id) on delete cascade,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_idx on crm.tasks (assignee_id, status);
create index tasks_due_idx on crm.tasks (due_at) where status in ('pending','in_progress');
create index tasks_customer_idx on crm.tasks (customer_id);
create index tasks_store_idx on crm.tasks (store_id);
create index tasks_opp_idx on crm.tasks (opportunity_id);

create table crm.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customers(id) on delete cascade,
  store_id uuid not null references crm.stores(id) on delete restrict,
  advisor_id uuid not null references crm.profiles(id) on delete restrict,
  opportunity_id uuid references crm.opportunities(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  purpose text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  exclude using gist (advisor_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'scheduled')
);
create index appointments_advisor_idx on crm.appointments (advisor_id, starts_at);
create index appointments_store_idx on crm.appointments (store_id, starts_at);
create index appointments_customer_idx on crm.appointments (customer_id, starts_at);

create table crm.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references crm.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedupe_uq on crm.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index notifications_user_idx on crm.notifications (user_id, created_at desc);
create index notifications_unread_idx on crm.notifications (user_id) where read_at is null;

create function crm.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text, p_key text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into crm.notifications (user_id, type, title, body, link, dedupe_key)
  values (p_user, p_type, p_title, p_body, p_link, p_key) on conflict do nothing;
end $$;
revoke execute on function crm.notify(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Görev tetikleyicileri
create function crm.tasks_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.title := btrim(new.title);
  if new.title = '' then raise exception 'Görev başlığı zorunlu'; end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.assignee_id is null then new.assignee_id := auth.uid(); end if;
  end if;
  if new.status = 'done' then new.completed_at := coalesce(new.completed_at, now()); else new.completed_at := null; end if;
  if tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id then
    if new.assignee_id is not null and auth.uid() is not null and new.assignee_id <> auth.uid()
       and not crm.has_perm('tasks.team') then
      raise exception 'Başkasına görev atama yetkiniz yok';
    end if;
    if new.assignee_id is not null and new.assignee_id <> coalesce(auth.uid(), new.assignee_id)
       and new.store_id is not null and not exists (select 1 from crm.store_memberships where user_id = new.assignee_id and store_id = new.store_id) then
      raise exception 'Atanan kişi bu mağazaya bağlı değil';
    end if;
  end if;
  return new;
end $$;
create trigger tasks_biu before insert or update on crm.tasks for each row execute function crm.tasks_before();
create trigger tasks_updated before update on crm.tasks for each row execute function crm.set_updated_at();

create function crm.tasks_after() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform crm.notify(new.assignee_id, 'task_assigned', 'Yeni görev: ' || new.title, null, '/crm/gorevler', 'task-assigned-' || new.id || '-' || new.assignee_id);
  end if;
  return null;
end $$;
create trigger tasks_ai after insert or update on crm.tasks for each row execute function crm.tasks_after();

-- Randevu tetikleyicileri
create function crm.appointments_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  if not exists (select 1 from crm.store_memberships where user_id = new.advisor_id and store_id = new.store_id) then
    raise exception 'Danışman bu mağazaya bağlı değil';
  end if;
  return new;
end $$;
create trigger appointments_biu before insert or update on crm.appointments for each row execute function crm.appointments_before();
create trigger appointments_updated before update on crm.appointments for each row execute function crm.set_updated_at();

create function crm.appointments_after() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select btrim(first_name || ' ' || last_name) into v_name from crm.customers where id = new.customer_id;
  if new.advisor_id is distinct from auth.uid() and new.status = 'scheduled'
     and (tg_op = 'INSERT' or new.advisor_id is distinct from old.advisor_id or new.starts_at is distinct from old.starts_at) then
    perform crm.notify(new.advisor_id, 'appointment', 'Randevu: ' || coalesce(v_name, 'müşteri'),
      to_char(new.starts_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'), '/crm/randevular',
      'appt-' || new.id || '-' || extract(epoch from new.starts_at)::bigint);
  end if;
  return null;
end $$;
create trigger appointments_ai after insert or update on crm.appointments for each row execute function crm.appointments_after();

-- Müşteri atanınca danışmana bildirim
create function crm.customers_assigned_notify() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and new.assigned_to is distinct from auth.uid() then
    perform crm.notify(new.assigned_to, 'customer_assigned', 'Size yeni müşteri atandı', btrim(new.first_name || ' ' || new.last_name), '/crm/musteriler/' || new.id,
      'cust-assigned-' || new.id || '-' || new.assigned_to);
  end if;
  return null;
end $$;
create trigger customers_assign_notify after insert or update of assigned_to on crm.customers
  for each row when (new.assigned_to is not null) execute function crm.customers_assigned_notify();

-- Zamanı gelen hatırlatmalar (pg_cron ile çalışır; tekrarlı bildirim dedupe_key ile engellenir)
create function crm.generate_due_notifications() returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; c int;
begin
  for r in select id, title, assignee_id from crm.tasks
           where status in ('pending','in_progress') and assignee_id is not null and due_at is not null and due_at < now() loop
    insert into crm.notifications (user_id, type, title, link, dedupe_key)
    values (r.assignee_id, 'task_overdue', 'Geciken görev: ' || r.title, '/crm/gorevler', 'task-overdue-' || r.id)
    on conflict do nothing; get diagnostics c = row_count; n := n + c;
  end loop;
  for r in select o.id, o.title, o.owner_id from crm.opportunities o
           where o.closed_at is null and o.owner_id is not null and o.next_follow_up_at is not null and o.next_follow_up_at < now() loop
    insert into crm.notifications (user_id, type, title, link, dedupe_key)
    values (r.owner_id, 'follow_up', 'Takip zamanı: ' || r.title, '/crm/firsatlar', 'follow-' || r.id || '-' || to_char(now(), 'YYYYMMDD'))
    on conflict do nothing; get diagnostics c = row_count; n := n + c;
  end loop;
  for r in select a.id, a.advisor_id, a.starts_at, btrim(c.first_name || ' ' || c.last_name) as cname
           from crm.appointments a join crm.customers c on c.id = a.customer_id
           where a.status = 'scheduled' and a.starts_at between now() and now() + interval '1 hour' loop
    insert into crm.notifications (user_id, type, title, body, link, dedupe_key)
    values (r.advisor_id, 'appointment_soon', 'Yaklaşan randevu: ' || r.cname, to_char(r.starts_at at time zone 'Europe/Istanbul', 'HH24:MI'), '/crm/randevular', 'appt-soon-' || r.id)
    on conflict do nothing; get diagnostics c = row_count; n := n + c;
  end loop;
  delete from crm.notifications where read_at is not null and read_at < now() - interval '90 days';
  return n;
end $$;
revoke execute on function crm.generate_due_notifications() from public, anon, authenticated;

create trigger audit_tasks after insert or update or delete on crm.tasks for each row execute function crm.audit_trigger_min();
create trigger audit_appointments after insert or update or delete on crm.appointments for each row execute function crm.audit_trigger_min();

-- RLS
alter table crm.tasks enable row level security;
alter table crm.appointments enable row level security;
alter table crm.notifications enable row level security;

create policy tasks_sel on crm.tasks for select to authenticated
  using ((select crm.has_perm('tasks.read')) and (
    assignee_id = (select auth.uid()) or created_by = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.has_perm('tasks.team')) and store_id in (select crm.my_store_ids()))));
create policy tasks_ins on crm.tasks for insert to authenticated
  with check ((select crm.has_perm('tasks.write')) and (store_id is null or (select crm.can_access_store(store_id)))
    and (customer_id is null or crm.can_access_customer(customer_id)));
create policy tasks_upd on crm.tasks for update to authenticated
  using ((select crm.has_perm('tasks.write')) and (
    assignee_id = (select auth.uid()) or created_by = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.has_perm('tasks.team')) and store_id in (select crm.my_store_ids()))))
  with check ((select crm.has_perm('tasks.write')));
create policy tasks_del on crm.tasks for delete to authenticated
  using ((select crm.has_perm('tasks.write')) and (created_by = (select auth.uid()) or (select crm.is_super_admin())));

create policy appt_sel on crm.appointments for select to authenticated
  using ((select crm.has_perm('appointments.read')) and (
    advisor_id = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or crm.can_access_customer(customer_id)));
create policy appt_ins on crm.appointments for insert to authenticated
  with check ((select crm.has_perm('appointments.write')) and (select crm.can_access_store(store_id)) and crm.can_access_customer(customer_id));
create policy appt_upd on crm.appointments for update to authenticated
  using ((select crm.has_perm('appointments.write')) and (advisor_id = (select auth.uid()) or created_by = (select auth.uid()) or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))))
  with check ((select crm.has_perm('appointments.write')) and (select crm.can_access_store(store_id)));

revoke insert, update, delete on crm.notifications from authenticated;
grant update (read_at) on crm.notifications to authenticated;
create policy notif_sel on crm.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_upd on crm.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

select cron.schedule('crm_due_notifications', '*/15 * * * *', $cron$select crm.generate_due_notifications()$cron$);
