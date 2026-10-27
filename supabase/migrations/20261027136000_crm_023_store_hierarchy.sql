-- Bayi/merkez → şube hiyerarşisi. Üst birimin yöneticileri (bayi yöneticisi, mağaza müdürü) şubelere otomatik üye olur.
alter table crm.stores add column parent_id uuid references crm.stores(id) on delete set null;
alter table crm.stores add constraint stores_no_self_parent check (parent_id is null or parent_id <> id);
create index stores_parent_idx on crm.stores (parent_id);

create function crm.stores_parent_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and tg_op = 'UPDATE' then
    if exists (
      with recursive up as (select s.id, s.parent_id from crm.stores s where s.id = new.parent_id
                            union select s.id, s.parent_id from crm.stores s join up on s.id = up.parent_id)
      select 1 from up where id = new.id) then
      raise exception 'Döngüsel bağlantı kurulamaz';
    end if;
  end if;
  return new;
end $$;
create trigger stores_parent_guard before insert or update of parent_id on crm.stores for each row execute function crm.stores_parent_guard();

create function crm.stores_inherit_members() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    insert into crm.store_memberships (user_id, store_id, is_primary)
    select distinct sm.user_id, new.id, false from crm.store_memberships sm
      join crm.user_roles ur on ur.user_id = sm.user_id and ur.role_code in ('dealer_admin', 'store_manager')
     where sm.store_id = new.parent_id
    on conflict do nothing;
  end if;
  return null;
end $$;
create trigger stores_inherit_members after insert or update of parent_id on crm.stores for each row execute function crm.stores_inherit_members();

create function crm.membership_cascade() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from crm.user_roles ur where ur.user_id = new.user_id and ur.role_code in ('dealer_admin', 'store_manager')) then
      insert into crm.store_memberships (user_id, store_id, is_primary)
      select new.user_id, s.id, false from crm.stores s where s.parent_id = new.store_id
      on conflict do nothing;
    end if;
  else
    delete from crm.store_memberships sm using crm.stores s
     where sm.user_id = old.user_id and sm.store_id = s.id and s.parent_id = old.store_id and not sm.is_primary;
  end if;
  return null;
end $$;
create trigger store_memberships_cascade after insert or delete on crm.store_memberships for each row execute function crm.membership_cascade();

revoke execute on function crm.stores_parent_guard(), crm.stores_inherit_members(), crm.membership_cascade() from public, anon, authenticated;
