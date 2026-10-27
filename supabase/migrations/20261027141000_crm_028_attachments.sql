-- Genel dosya ekleri (müşteri, sipariş, fırsat, teklif, B2B hesap)
insert into crm.permissions (code, module, description) values
  ('attachments.read', 'data', 'Dosya eklerini görüntüle / indir'),
  ('attachments.write', 'data', 'Dosya ekle / sil')
on conflict do nothing;
insert into crm.role_permissions (role_code, permission_code)
select distinct rp.role_code, 'attachments.read' from crm.role_permissions rp where rp.permission_code = 'customers.read'
on conflict do nothing;
insert into crm.role_permissions (role_code, permission_code)
select distinct rp.role_code, 'attachments.write' from crm.role_permissions rp where rp.permission_code = 'customers.write'
on conflict do nothing;

create table crm.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer','order','opportunity','quotation','business_account')),
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  description text,
  uploaded_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (storage_path like entity_type || '/' || entity_id::text || '/%')
);
create index attachments_entity_idx on crm.attachments (entity_type, entity_id, created_at desc);

-- Kayıt, çağıranın RLS ile görebildiği bir kayıt mı? (invoker: tablo RLS'i uygulanır)
create function crm.can_see_entity(p_type text, p_id uuid) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
  return case p_type
    when 'customer' then exists (select 1 from crm.customers where id = p_id)
    when 'order' then exists (select 1 from crm.orders where id = p_id)
    when 'opportunity' then exists (select 1 from crm.opportunities where id = p_id)
    when 'quotation' then exists (select 1 from crm.quotations where id = p_id)
    when 'business_account' then exists (select 1 from crm.business_accounts where id = p_id)
    else false end;
end $$;

-- Depolama yolu: <tür>/<kayıt id>/<dosya>; bozuk yol sessizce reddedilir
create function crm.storage_path_ok(p_name text, p_perm text) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare parts text[] := string_to_array(p_name, '/');
begin
  if array_length(parts, 1) <> 3 then return false; end if;
  return (select crm.has_perm(p_perm)) and crm.can_see_entity(parts[1], parts[2]::uuid);
exception when others then return false;
end $$;
revoke execute on function crm.can_see_entity(text, uuid), crm.storage_path_ok(text, text) from public, anon;
grant execute on function crm.can_see_entity(text, uuid), crm.storage_path_ok(text, text) to authenticated;

alter table crm.attachments enable row level security;
grant select, insert, delete on crm.attachments to authenticated;
create policy att_sel on crm.attachments for select to authenticated using ((select crm.has_perm('attachments.read')) and crm.can_see_entity(entity_type, entity_id));
create policy att_ins on crm.attachments for insert to authenticated with check (
  (select crm.has_perm('attachments.write')) and uploaded_by = (select auth.uid()) and crm.can_see_entity(entity_type, entity_id));
create policy att_del on crm.attachments for delete to authenticated using (
  (select crm.has_perm('attachments.write')) and (uploaded_by = (select auth.uid()) or (select crm.is_super_admin())));
create trigger audit_attachments after insert or delete on crm.attachments for each row execute function crm.audit_trigger_min();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('crm-files', 'crm-files', false, 10485760, array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword','application/vnd.ms-excel'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy crm_files_read on storage.objects for select to authenticated using (bucket_id = 'crm-files' and crm.storage_path_ok(name, 'attachments.read'));
create policy crm_files_write on storage.objects for insert to authenticated with check (bucket_id = 'crm-files' and crm.storage_path_ok(name, 'attachments.write'));
create policy crm_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'crm-files' and crm.storage_path_ok(name, 'attachments.write') and (owner_id = (select auth.uid())::text or (select crm.is_super_admin())));
