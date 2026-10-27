-- Tekrarlayan görevler: tamamlanınca bir sonraki tekrar otomatik açılır
alter table crm.tasks add column recurrence text check (recurrence in ('daily','weekly','monthly','yearly'));
alter table crm.tasks add column recurrence_interval int not null default 1 check (recurrence_interval between 1 and 365);
alter table crm.tasks add column recurrence_until date;
alter table crm.tasks add column recurrence_parent uuid references crm.tasks(id) on delete set null;
alter table crm.tasks add column next_spawned boolean not null default false;
alter table crm.tasks add constraint tasks_recurrence_needs_due check (recurrence is null or due_at is not null);
create index tasks_recurrence_parent_idx on crm.tasks (recurrence_parent) where recurrence_parent is not null;

create function crm.tasks_recur() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_step interval; v_next timestamptz; n int := 0;
begin
  if new.status <> 'done' or old.status = 'done' or new.recurrence is null or new.next_spawned then return null; end if;
  v_step := case new.recurrence
    when 'daily' then make_interval(days => new.recurrence_interval)
    when 'weekly' then make_interval(weeks => new.recurrence_interval)
    when 'monthly' then make_interval(months => new.recurrence_interval)
    else make_interval(years => new.recurrence_interval) end;
  v_next := new.due_at + v_step;
  while v_next < now() and n < 800 loop v_next := v_next + v_step; n := n + 1; end loop;
  if new.recurrence_until is not null and (v_next at time zone 'Europe/Istanbul')::date > new.recurrence_until then
    update crm.tasks set next_spawned = true where id = new.id; return null;
  end if;
  begin
    insert into crm.tasks (title, description, status, priority, due_at, assignee_id, store_id, customer_id, opportunity_id, created_by,
                           recurrence, recurrence_interval, recurrence_until, recurrence_parent)
    values (new.title, new.description, 'pending', new.priority, v_next, new.assignee_id, new.store_id, new.customer_id, new.opportunity_id, new.created_by,
            new.recurrence, new.recurrence_interval, new.recurrence_until, coalesce(new.recurrence_parent, new.id));
    update crm.tasks set next_spawned = true where id = new.id;
  exception when others then
    perform crm.notify(coalesce(new.assignee_id, new.created_by), 'task_recurrence', 'Tekrarlayan görev açılamadı: ' || new.title, sqlerrm, '/crm/gorevler', 'task-recur-fail-' || new.id);
  end;
  return null;
end $$;
create trigger tasks_recur_au after update of status on crm.tasks for each row execute function crm.tasks_recur();
revoke execute on function crm.tasks_recur() from public, anon, authenticated;
