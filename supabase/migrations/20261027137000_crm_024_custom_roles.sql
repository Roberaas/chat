-- Özel roller: süper admin yeni rol açar, yetkileri işaretler, isteğe bağlı mağazaya bağlar, bayi/müdürün atayabilmesine izin verir.
alter table crm.roles add column is_system boolean not null default false;
update crm.roles set is_system = true;
alter table crm.roles add column store_id uuid references crm.stores(id) on delete set null;
alter table crm.roles add column delegable boolean not null default false;
alter table crm.roles add column created_by uuid;
alter table crm.roles add column created_at timestamptz not null default now();
create index roles_store_idx on crm.roles (store_id);

-- Süper admin dışındaki roller bu yetkilerle devredilemez (yükseltme koruması)
create or replace function crm.can_delegate_role(p_role text) returns boolean language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin()
      or (crm.has_role('dealer_admin') and p_role in ('dealer_user', 'sales_advisor'))
      or (crm.has_role('store_manager') and p_role = 'sales_advisor')
      or ((crm.has_role('dealer_admin') or crm.has_role('store_manager'))
          and exists (select 1 from crm.roles r where r.code = p_role and not r.is_system and r.delegable and r.scope <> 'all'
                      and (r.store_id is null or r.store_id in (select crm.my_store_ids()))
                      and not exists (select 1 from crm.role_permissions rp where rp.role_code = r.code
                                      and rp.permission_code in ('users.manage','settings.manage','integrations.manage','stores.manage','audit.read'))))
$$;

create policy roles_write on crm.roles for all to authenticated
  using ((select crm.is_super_admin()) and code <> 'super_admin' and not is_system)
  with check ((select crm.is_super_admin()) and code <> 'super_admin' and not is_system);
create policy role_permissions_write on crm.role_permissions for all to authenticated
  using ((select crm.is_super_admin()) and role_code <> 'super_admin' and role_code in (select code from crm.roles where not is_system))
  with check ((select crm.is_super_admin()) and role_code <> 'super_admin' and role_code in (select code from crm.roles where not is_system));
grant insert, update, delete on crm.roles, crm.role_permissions to authenticated;

create function crm.roles_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then raise exception 'Sistem rolü silinemez'; end if;
    if exists (select 1 from crm.user_roles where role_code = old.code) then raise exception 'Bu role atanmış kullanıcılar var; önce rollerini değiştirin'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.code <> old.code or new.is_system <> old.is_system) then raise exception 'Rol kodu değiştirilemez'; end if;
  if tg_op = 'INSERT' and (new.is_system or new.code !~ '^[a-z0-9_]{3,40}$') then raise exception 'Geçersiz rol kodu'; end if;
  if new.scope = 'all' and not new.is_system and tg_op = 'INSERT' then new.scope := 'stores'; end if;
  return new;
end $$;
create trigger roles_guard before insert or update or delete on crm.roles for each row execute function crm.roles_guard();
revoke execute on function crm.roles_guard() from public, anon, authenticated;

-- Denetim kaydı: roller (role_permissions için mevcut audit_role_permissions tetikleyicisi kullanılır)
create function crm.audit_roles() returns trigger language plpgsql security definer set search_path = '' as $$
declare v jsonb := to_jsonb(coalesce(new, old));
begin
  insert into crm.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name, v->>'code',
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) || jsonb_build_object('label', v->>'name') end);
  return null;
end $$;
create trigger audit_roles after insert or update or delete on crm.roles for each row execute function crm.audit_roles();
revoke execute on function crm.audit_roles() from public, anon, authenticated;
