-- Bayi yöneticisi / mağaza müdürü kendi birimine bağlı şube açabilir ve yönetebilir (stores.manage gerekmez).
create function crm.create_branch(p_parent uuid, p_code text, p_name text, p_city text, p_address text, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_parent crm.stores; v_id uuid; v_code text;
begin
  if auth.uid() is null or not crm.is_active_user() then raise exception 'Oturum gerekli' using errcode = '42501'; end if;
  if not (crm.is_super_admin() or crm.has_role('dealer_admin') or crm.has_role('store_manager')) then
    raise exception 'Şube açma yetkiniz yok' using errcode = '42501'; end if;
  select * into v_parent from crm.stores where id = p_parent;
  if v_parent.id is null or not crm.can_access_store(p_parent) then raise exception 'Bu birime şube ekleme yetkiniz yok' using errcode = '42501'; end if;
  if btrim(coalesce(p_name, '')) = '' or btrim(coalesce(p_code, '')) = '' then raise exception 'Kod ve ad gerekli'; end if;
  if (select count(*) from crm.stores where parent_id = p_parent) >= 100 then raise exception 'Şube sınırına ulaşıldı'; end if;
  v_code := upper(regexp_replace(v_parent.code || '-' || btrim(p_code), '[^A-Za-z0-9_-]', '', 'g'));
  if exists (select 1 from crm.stores where organization_id = v_parent.organization_id and code = v_code) then raise exception 'Bu şube kodu kullanımda'; end if;
  insert into crm.stores (organization_id, code, name, store_type, city, address, phone, parent_id)
  values (v_parent.organization_id, v_code, btrim(p_name), case when v_parent.store_type in ('dealer','wholesale') then v_parent.store_type else 'store' end,
          nullif(btrim(p_city), ''), nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''), p_parent)
  returning id into v_id;
  return v_id;
end $$;

create function crm.update_branch(p_id uuid, p_name text, p_city text, p_address text, p_phone text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v crm.stores;
begin
  if auth.uid() is null or not crm.is_active_user() then raise exception 'Oturum gerekli' using errcode = '42501'; end if;
  select * into v from crm.stores where id = p_id;
  if v.id is null or v.parent_id is null or not (crm.is_super_admin() or (crm.has_role('dealer_admin') or crm.has_role('store_manager'))) then
    raise exception 'Bu şubeyi düzenleme yetkiniz yok' using errcode = '42501'; end if;
  if not crm.is_super_admin() and v.parent_id not in (select crm.my_store_ids()) then raise exception 'Bu şubeyi düzenleme yetkiniz yok' using errcode = '42501'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Ad gerekli'; end if;
  update crm.stores set name = btrim(p_name), city = nullif(btrim(p_city), ''), address = nullif(btrim(p_address), ''),
         phone = nullif(btrim(p_phone), ''), is_active = coalesce(p_active, is_active) where id = p_id;
end $$;
revoke execute on function crm.create_branch(uuid, text, text, text, text, text), crm.update_branch(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function crm.create_branch(uuid, text, text, text, text, text), crm.update_branch(uuid, text, text, text, text, boolean) to authenticated;
