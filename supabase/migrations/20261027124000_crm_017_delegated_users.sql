-- Bayi / mağaza yöneticisi kendi mağazasındaki kullanıcıları yönetir (yetki devri, sınırlı)
create or replace function crm.can_delegate_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin()
      or (crm.has_role('dealer_admin') and p_role in ('dealer_user', 'sales_advisor'))
      or (crm.has_role('store_manager') and p_role = 'sales_advisor')
$$;

-- Hedef kullanıcıyı yönetebilir mi? Süper admin: evet. Diğerleri: hedef kendisi değil, süper admin/üst rol değil,
-- tüm mağazaları çağıranın mağazaları içinde ve tüm rolleri devredilebilir olmalı.
create or replace function crm.delegation_ok(p_target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin() or (
    crm.is_active_user() and crm.has_perm('users.manage') and p_target <> auth.uid()
    and exists (select 1 from crm.store_memberships where user_id = p_target)
    and not exists (select 1 from crm.store_memberships sm where sm.user_id = p_target and sm.store_id not in (select crm.my_store_ids()))
    and not exists (select 1 from crm.user_roles ur where ur.user_id = p_target and not crm.can_delegate_role(ur.role_code)))
$$;

create or replace function crm.delegated_provision_user(p_uid uuid, p_first text, p_last text, p_email text, p_phone text, p_role text, p_stores uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; s uuid; i int := 0;
begin
  if auth.uid() is null or not crm.is_active_user() or not crm.has_perm('users.manage') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  if not crm.can_delegate_role(p_role) then raise exception 'Bu rolü atama yetkiniz yok' using errcode = '42501'; end if;
  if p_stores is null or cardinality(p_stores) = 0 then raise exception 'En az bir mağaza seçin'; end if;
  foreach s in array p_stores loop
    if not crm.can_access_store(s) then raise exception 'Bu mağazaya kullanıcı ekleme yetkiniz yok' using errcode = '42501'; end if;
  end loop;
  if exists (select 1 from crm.profiles where id = p_uid) then raise exception 'Kullanıcı zaten var'; end if;
  select organization_id into v_org from crm.profiles where id = auth.uid();
  insert into crm.profiles (id, organization_id, first_name, last_name, email, phone, created_by, must_change_password)
  values (p_uid, v_org, btrim(p_first), btrim(p_last), lower(btrim(p_email)), nullif(btrim(p_phone), ''), auth.uid(), true);
  insert into crm.user_roles (user_id, role_code, granted_by) values (p_uid, p_role, auth.uid());
  foreach s in array p_stores loop
    i := i + 1;
    insert into crm.store_memberships (user_id, store_id, is_primary) values (p_uid, s, i = 1);
  end loop;
end $$;

create or replace function crm.delegated_update_user(p_id uuid, p_first text, p_last text, p_phone text, p_active boolean, p_role text, p_stores uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare s uuid;
begin
  if not crm.delegation_ok(p_id) then raise exception 'Bu kullanıcıyı yönetme yetkiniz yok' using errcode = '42501'; end if;
  if p_active is not null and p_id = auth.uid() and not p_active then raise exception 'Kendi hesabınızı pasifleştiremezsiniz'; end if;
  update crm.profiles set first_name = coalesce(nullif(btrim(p_first), ''), first_name), last_name = coalesce(nullif(btrim(p_last), ''), last_name),
         phone = case when p_phone is null then phone else nullif(btrim(p_phone), '') end, is_active = coalesce(p_active, is_active)
   where id = p_id;
  if p_role is not null then
    if not crm.can_delegate_role(p_role) then raise exception 'Bu rolü atama yetkiniz yok' using errcode = '42501'; end if;
    delete from crm.user_roles where user_id = p_id and role_code <> p_role;
    insert into crm.user_roles (user_id, role_code, granted_by) values (p_id, p_role, auth.uid()) on conflict do nothing;
  end if;
  if p_stores is not null then
    if cardinality(p_stores) = 0 then raise exception 'En az bir mağaza seçin'; end if;
    foreach s in array p_stores loop
      if not crm.can_access_store(s) then raise exception 'Bu mağazaya kullanıcı ekleme yetkiniz yok' using errcode = '42501'; end if;
      insert into crm.store_memberships (user_id, store_id, is_primary) values (p_id, s, false) on conflict do nothing;
    end loop;
    delete from crm.store_memberships where user_id = p_id and store_id in (select crm.my_store_ids()) and store_id <> all (p_stores);
    if not exists (select 1 from crm.store_memberships where user_id = p_id and is_primary) then
      update crm.store_memberships set is_primary = true where user_id = p_id and store_id = p_stores[1];
    end if;
  end if;
end $$;

revoke all on function crm.can_delegate_role(text), crm.delegation_ok(uuid), crm.delegated_provision_user(uuid, text, text, text, text, text, uuid[]),
  crm.delegated_update_user(uuid, text, text, text, boolean, text, uuid[]) from public, anon;
grant execute on function crm.can_delegate_role(text), crm.delegation_ok(uuid), crm.delegated_provision_user(uuid, text, text, text, text, text, uuid[]),
  crm.delegated_update_user(uuid, text, text, text, boolean, text, uuid[]) to authenticated;
