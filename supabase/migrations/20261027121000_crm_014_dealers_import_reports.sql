-- Bayi/toptancı modeli, Excel içe aktarma altyapısı, raporlar, aktivite izleme, duyurular

-- 1) Bayi / toptancı mağaza türleri ve roller
alter table crm.stores drop constraint if exists stores_store_type_check;
alter table crm.stores add constraint stores_store_type_check check (store_type in ('store','hq','online','dealer','wholesale'));

insert into crm.roles (code, name, description, scope, sort_order) values
  ('dealer_admin', 'Bayi / Toptancı Yöneticisi', 'Kendi bayisinin müşteri, fırsat, sipariş ve kullanıcılarını yönetir', 'stores', 9),
  ('dealer_user',  'Bayi / Toptancı Kullanıcısı', 'Kendi bayisinin müşterileriyle çalışır', 'stores', 10)
on conflict (code) do nothing;

insert into crm.permissions (code, module, description) values
  ('data.import', 'data', 'Excel ile içe aktarma'),
  ('activity.read', 'admin', 'Kullanıcı aktivitesi ve izleme'),
  ('announcements.manage', 'admin', 'Duyuru gönderme')
on conflict (code) do nothing;

insert into crm.role_permissions (role_code, permission_code)
select r, p from (values
  ('super_admin','data.import'),('super_admin','activity.read'),('super_admin','announcements.manage'),
  ('executive','activity.read'),
  ('store_manager','data.import'),('store_manager','customers.export'),
  ('crm_marketing','data.import'),
  ('dealer_admin','customers.read'),('dealer_admin','customers.write'),('dealer_admin','customers.assign'),('dealer_admin','customers.export'),
  ('dealer_admin','data.import'),('dealer_admin','dashboard.read'),('dealer_admin','opportunities.read'),('dealer_admin','opportunities.write'),
  ('dealer_admin','quotations.write'),('dealer_admin','orders.read'),('dealer_admin','products.read'),('dealer_admin','tasks.read'),
  ('dealer_admin','tasks.write'),('dealer_admin','tasks.team'),('dealer_admin','appointments.read'),('dealer_admin','appointments.write'),
  ('dealer_admin','consents.read'),('dealer_admin','consents.write'),('dealer_admin','service.read'),('dealer_admin','service.write'),
  ('dealer_admin','reports.read'),('dealer_admin','users.read'),('dealer_admin','users.manage'),
  ('dealer_user','customers.read'),('dealer_user','customers.write'),('dealer_user','dashboard.read'),('dealer_user','opportunities.read'),
  ('dealer_user','opportunities.write'),('dealer_user','quotations.write'),('dealer_user','orders.read'),('dealer_user','products.read'),
  ('dealer_user','tasks.read'),('dealer_user','tasks.write'),('dealer_user','appointments.read'),('dealer_user','appointments.write'),
  ('dealer_user','consents.read'),('dealer_user','consents.write'),('dealer_user','service.read')
) as t(r, p)
where exists (select 1 from crm.roles where code = r) and exists (select 1 from crm.permissions where code = p)
on conflict do nothing;

-- 2) Son görülme (aktivite izleme)
alter table crm.profiles add column if not exists last_seen_at timestamptz;
create or replace function crm.touch_seen() returns void
language sql security definer set search_path = '' as $$
  update crm.profiles set last_seen_at = now()
   where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '2 minutes')
$$;
revoke all on function crm.touch_seen() from public, anon;
grant execute on function crm.touch_seen() to authenticated;

-- 3) İçe aktarma işleri
create table if not exists crm.import_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('customers','products','b2b_accounts')),
  file_name text,
  store_id uuid references crm.stores(id) on delete set null,
  mode text not null default 'skip' check (mode in ('skip','update')),
  status text not null default 'running' check (status in ('running','done','failed')),
  total int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  error_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references crm.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists import_jobs_user_idx on crm.import_jobs (created_by, created_at desc);
create index if not exists import_jobs_store_idx on crm.import_jobs (store_id);
alter table crm.import_jobs enable row level security;
create policy ij_sel on crm.import_jobs for select to authenticated
  using (created_by = (select auth.uid()) or (select crm.has_perm('activity.read')));
grant select on crm.import_jobs to authenticated;
create trigger audit_import_jobs after insert or update or delete on crm.import_jobs for each row execute function crm.audit_trigger_min();

create or replace function crm.import_start(p_kind text, p_file text, p_store uuid, p_mode text, p_total int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not crm.is_active_user() or not crm.has_perm('data.import') then
    raise exception 'İçe aktarma yetkiniz yok' using errcode = '42501';
  end if;
  if p_kind = 'customers' and (p_store is null or not crm.can_access_store(p_store) or not crm.has_perm('customers.write')) then
    raise exception 'Bu mağazaya müşteri ekleme yetkiniz yok' using errcode = '42501';
  end if;
  if p_kind = 'products' and not crm.has_perm('products.write') then raise exception 'Ürün yazma yetkiniz yok' using errcode = '42501'; end if;
  if p_kind = 'b2b_accounts' and not crm.has_perm('b2b.write') then raise exception 'B2B yazma yetkiniz yok' using errcode = '42501'; end if;
  if p_total < 1 or p_total > 20000 then raise exception 'Satır sayısı 1-20000 arasında olmalı'; end if;
  insert into crm.import_jobs (kind, file_name, store_id, mode, total)
  values (p_kind, left(p_file, 200), p_store, case when p_mode = 'update' then 'update' else 'skip' end, p_total)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function crm.import_start(text, text, uuid, text, int) from public, anon;
grant execute on function crm.import_start(text, text, uuid, text, int) to authenticated;

create or replace function crm.import_progress(p_job uuid, p_c int, p_u int, p_s int, p_errs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update crm.import_jobs j set
    created_count = j.created_count + p_c, updated_count = j.updated_count + p_u, skipped_count = j.skipped_count + p_s,
    error_count = j.error_count + jsonb_array_length(p_errs),
    errors = (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(j.errors || p_errs) e limit 200) x)
  where j.id = p_job and j.created_by = auth.uid() and j.status = 'running';
end $$;
revoke all on function crm.import_progress(uuid, int, int, int, jsonb) from public, anon;
grant execute on function crm.import_progress(uuid, int, int, int, jsonb) to authenticated;

create or replace function crm.import_finish(p_job uuid)
returns crm.import_jobs language plpgsql security definer set search_path = '' as $$
declare j crm.import_jobs;
begin
  update crm.import_jobs set status = 'done', finished_at = now()
   where id = p_job and created_by = auth.uid() and status = 'running' returning * into j;
  if j.id is null then raise exception 'İş bulunamadı'; end if;
  perform crm.notify(j.created_by, 'import',
    'İçe aktarma tamamlandı',
    format('%s: %s eklendi, %s güncellendi, %s atlandı, %s hata', coalesce(j.file_name, j.kind), j.created_count, j.updated_count, j.skipped_count, j.error_count),
    '/crm/iceaktar', 'import:' || j.id);
  return j;
end $$;
revoke all on function crm.import_finish(uuid) from public, anon;
grant execute on function crm.import_finish(uuid) to authenticated;

-- Müşteri satırları (RLS ve tetikleyiciler geçerli: kullanıcı yalnız yetkili olduğu mağazaya yazabilir)
create or replace function crm.import_customers(p_job uuid, p_rows jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  j crm.import_jobs; org uuid; r jsonb; v_first text; v_last text; v_city text; v_src text; v_birth date;
  np text; ne text; ex uuid; c int := 0; u int := 0; s int := 0; errs jsonb := '[]'::jsonb; upd int;
begin
  select * into j from crm.import_jobs where id = p_job and created_by = auth.uid() and status = 'running' and kind = 'customers';
  if j.id is null then raise exception 'İçe aktarma işi bulunamadı'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'En fazla 500 satır gönderilebilir'; end if;
  select organization_id into org from crm.stores where id = j.store_id;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      v_first := nullif(btrim(r->>'first_name'), ''); v_last := nullif(btrim(r->>'last_name'), ''); v_city := nullif(btrim(r->>'city'), '');
      if v_first is null then raise exception 'Ad zorunlu'; end if;
      np := crm.norm_phone(r->>'phone'); ne := crm.norm_email(r->>'email');
      if coalesce(r->>'phone','') <> '' and np is null then raise exception 'Telefon geçersiz'; end if;
      if coalesce(r->>'email','') <> '' and (ne is null or ne !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then raise exception 'E-posta geçersiz'; end if;
      if np is null and ne is null then raise exception 'Telefon veya e-posta gerekli'; end if;
      v_src := lower(coalesce(nullif(btrim(r->>'source'), ''), 'other'));
      if v_src not in ('walk_in','whatsapp','ecommerce','referral','event','social','phone','other') then v_src := 'other'; end if;
      v_birth := null;
      if coalesce(r->>'birth_date','') <> '' then
        begin v_birth := (r->>'birth_date')::date; exception when others then raise exception 'Doğum tarihi geçersiz (YYYY-AA-GG)'; end;
        if v_birth > current_date or v_birth < date '1900-01-01' then raise exception 'Doğum tarihi geçersiz'; end if;
      end if;
      select id into ex from crm.customers
       where organization_id = org and status = 'active' and ((np is not null and phone_norm = np) or (ne is not null and email_norm = ne)) limit 1;
      if ex is not null then
        if j.mode = 'update' then
          update crm.customers set first_name = coalesce(v_first, first_name), last_name = coalesce(v_last, last_name),
                 city = coalesce(v_city, city), birth_date = coalesce(v_birth, birth_date),
                 email = coalesce(ne, email), phone = coalesce(phone, nullif(btrim(r->>'phone'), ''))
           where id = ex;
          get diagnostics upd = row_count;
          if upd > 0 then u := u + 1; else s := s + 1; end if;
        else
          s := s + 1;
        end if;
      else
        insert into crm.customers (organization_id, store_id, first_name, last_name, phone, email, source, city, birth_date)
        values (org, j.store_id, v_first, coalesce(v_last, ''), nullif(btrim(r->>'phone'), ''), ne, v_src, v_city, v_birth);
        c := c + 1;
      end if;
    exception
      when unique_violation then errs := errs || jsonb_build_object('row', r->>'row', 'msg', 'Bu telefon/e-posta başka bir kayıtta var');
      when insufficient_privilege then errs := errs || jsonb_build_object('row', r->>'row', 'msg', 'Bu işlem için yetkiniz yok');
      when others then errs := errs || jsonb_build_object('row', r->>'row', 'msg', sqlerrm);
    end;
  end loop;
  perform crm.import_progress(p_job, c, u, s, errs);
  return jsonb_build_object('created', c, 'updated', u, 'skipped', s, 'errors', errs);
end $$;
revoke all on function crm.import_customers(uuid, jsonb) from public, anon;
grant execute on function crm.import_customers(uuid, jsonb) to authenticated;

-- Ürün satırları (yalnız elle girilen ürünler; ERP kaynaklı ürünler korunur)
create or replace function crm.import_products(p_job uuid, p_rows jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  j crm.import_jobs; r jsonb; v_sku text; v_name text; v_price numeric; v_status text; v_coll uuid; ex record;
  c int := 0; u int := 0; s int := 0; errs jsonb := '[]'::jsonb;
begin
  select * into j from crm.import_jobs where id = p_job and created_by = auth.uid() and status = 'running' and kind = 'products';
  if j.id is null then raise exception 'İçe aktarma işi bulunamadı'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'En fazla 500 satır gönderilebilir'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      v_sku := nullif(btrim(r->>'sku'), ''); v_name := nullif(btrim(r->>'name'), '');
      if v_sku is null or v_name is null then raise exception 'Stok kodu ve ürün adı zorunlu'; end if;
      v_price := null;
      if coalesce(r->>'price','') <> '' then
        begin v_price := replace(r->>'price', ',', '.')::numeric; exception when others then raise exception 'Fiyat geçersiz'; end;
        if v_price < 0 then raise exception 'Fiyat negatif olamaz'; end if;
      end if;
      v_status := lower(coalesce(nullif(btrim(r->>'status'), ''), 'active'));
      if v_status not in ('draft','active','discontinued') then raise exception 'Durum geçersiz (draft/active/discontinued)'; end if;
      v_coll := null;
      if coalesce(r->>'collection','') <> '' then
        select id into v_coll from crm.collections where lower(name) = lower(btrim(r->>'collection')) or lower(code) = lower(btrim(r->>'collection')) limit 1;
        if v_coll is null then raise exception 'Koleksiyon bulunamadı: %', r->>'collection'; end if;
      end if;
      select id, source_system into ex from crm.products where sku = v_sku;
      if ex.id is not null then
        if ex.source_system is not null then raise exception 'ERP/POS kaynaklı ürün elle değiştirilemez'; end if;
        if j.mode = 'update' then
          update crm.products set name = v_name, category = coalesce(nullif(btrim(r->>'category'), ''), category),
                 material = coalesce(nullif(btrim(r->>'material'), ''), material), description = coalesce(nullif(btrim(r->>'description'), ''), description),
                 price = coalesce(v_price, price), status = v_status, collection_id = coalesce(v_coll, collection_id)
           where id = ex.id;
          u := u + 1;
        else s := s + 1; end if;
      else
        insert into crm.products (sku, name, category, material, description, price, status, collection_id)
        values (v_sku, v_name, nullif(btrim(r->>'category'), ''), nullif(btrim(r->>'material'), ''), nullif(btrim(r->>'description'), ''), v_price, v_status, v_coll);
        c := c + 1;
      end if;
    exception
      when insufficient_privilege then errs := errs || jsonb_build_object('row', r->>'row', 'msg', 'Bu işlem için yetkiniz yok');
      when others then errs := errs || jsonb_build_object('row', r->>'row', 'msg', sqlerrm);
    end;
  end loop;
  perform crm.import_progress(p_job, c, u, s, errs);
  return jsonb_build_object('created', c, 'updated', u, 'skipped', s, 'errors', errs);
end $$;
revoke all on function crm.import_products(uuid, jsonb) from public, anon;
grant execute on function crm.import_products(uuid, jsonb) to authenticated;

-- B2B firma satırları (VKN varsa VKN, yoksa ad ile eşleşir)
create or replace function crm.import_b2b_accounts(p_job uuid, p_rows jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  j crm.import_jobs; r jsonb; v_name text; v_type text; v_status text; v_tax text; ex uuid;
  c int := 0; u int := 0; s int := 0; errs jsonb := '[]'::jsonb;
begin
  select * into j from crm.import_jobs where id = p_job and created_by = auth.uid() and status = 'running' and kind = 'b2b_accounts';
  if j.id is null then raise exception 'İçe aktarma işi bulunamadı'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'En fazla 500 satır gönderilebilir'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      v_name := nullif(btrim(r->>'name'), '');
      if v_name is null then raise exception 'Firma adı zorunlu'; end if;
      v_type := lower(coalesce(nullif(btrim(r->>'type'), ''), 'dealer'));
      v_status := lower(coalesce(nullif(btrim(r->>'status'), ''), 'prospect'));
      if v_type not in ('dealer','corporate','wholesale') then raise exception 'Tür geçersiz (dealer/corporate/wholesale)'; end if;
      if v_status not in ('prospect','active','suspended','closed') then raise exception 'Durum geçersiz'; end if;
      v_tax := nullif(regexp_replace(coalesce(r->>'tax_no',''), '\D', '', 'g'), '');
      if v_tax is not null and length(v_tax) not in (10, 11) then raise exception 'Vergi no 10 veya 11 haneli olmalı'; end if;
      if v_tax is not null then select id into ex from crm.business_accounts where tax_no = v_tax;
      else select id into ex from crm.business_accounts where lower(name) = lower(v_name) limit 1; end if;
      if ex is not null then
        if j.mode = 'update' then
          update crm.business_accounts set type = v_type, status = v_status,
                 tax_office = coalesce(nullif(btrim(r->>'tax_office'), ''), tax_office), city = coalesce(nullif(btrim(r->>'city'), ''), city),
                 phone = coalesce(nullif(btrim(r->>'phone'), ''), phone), email = coalesce(nullif(btrim(r->>'email'), ''), email),
                 notes = coalesce(nullif(btrim(r->>'notes'), ''), notes)
           where id = ex;
          u := u + 1;
        else s := s + 1; end if;
      else
        insert into crm.business_accounts (name, type, status, tax_office, tax_no, city, phone, email, notes)
        values (v_name, v_type, v_status, nullif(btrim(r->>'tax_office'), ''), v_tax, nullif(btrim(r->>'city'), ''),
                nullif(btrim(r->>'phone'), ''), nullif(btrim(r->>'email'), ''), nullif(btrim(r->>'notes'), ''));
        c := c + 1;
      end if;
    exception
      when unique_violation then errs := errs || jsonb_build_object('row', r->>'row', 'msg', 'Bu vergi numarası başka bir firmada kayıtlı');
      when insufficient_privilege then errs := errs || jsonb_build_object('row', r->>'row', 'msg', 'Bu işlem için yetkiniz yok');
      when others then errs := errs || jsonb_build_object('row', r->>'row', 'msg', sqlerrm);
    end;
  end loop;
  perform crm.import_progress(p_job, c, u, s, errs);
  return jsonb_build_object('created', c, 'updated', u, 'skipped', s, 'errors', errs);
end $$;
revoke all on function crm.import_b2b_accounts(uuid, jsonb) from public, anon;
grant execute on function crm.import_b2b_accounts(uuid, jsonb) to authenticated;

grant execute on function crm.norm_phone(text) to authenticated;
grant execute on function crm.norm_email(text) to authenticated;
