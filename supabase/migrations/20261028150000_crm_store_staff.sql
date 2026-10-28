-- Mağaza personeli: yalnızca müşteri kaydı + kendi mağazasında arama. Tablolara doğrudan erişimi yoktur, sadece bu iki işlem (RPC).
insert into crm.permissions (code, module, description) values
  ('customers.register', 'customers', 'Mağaza ekranından müşteri kaydı oluşturma (çift kayıt engellenir)'),
  ('customers.search', 'customers', 'Mağaza ekranında kendi mağazasının müşterilerinde arama')
on conflict do nothing;

alter table crm.roles disable trigger roles_guard;
insert into crm.roles (code, name, description, scope, sort_order, is_system, delegable)
values ('store_staff', 'Mağaza Personeli', 'Tablet ekranı: yalnızca müşteri kaydı ve arama', 'stores', 90, true, true)
on conflict (code) do nothing;
alter table crm.roles enable trigger roles_guard;
insert into crm.role_permissions (role_code, permission_code) values ('store_staff', 'customers.register'), ('store_staff', 'customers.search') on conflict do nothing;

create or replace function crm.can_delegate_role(p_role text) returns boolean language sql stable security definer set search_path = '' as $$
  select crm.is_super_admin() or (crm.has_role('dealer_admin') and p_role in ('dealer_user', 'sales_advisor', 'store_staff'))
    or (crm.has_role('store_manager') and p_role in ('sales_advisor', 'store_staff'))
    or ((crm.has_role('dealer_admin') or crm.has_role('store_manager')) and exists (select 1 from crm.roles r where r.code = p_role and not r.is_system and r.delegable and r.scope <> 'all' and (r.store_id is null or r.store_id in (select crm.my_store_ids())) and not exists (select 1 from crm.role_permissions rp where rp.role_code = r.code and rp.permission_code in ('users.manage','settings.manage','integrations.manage','stores.manage','audit.read'))))
$$;

-- Kayıt: çift kaydı engeller. Başka mağazanın müşterisinde ayrıntı vermez (maskeli), istenirse "mağazama bağla".
create or replace function crm.register_customer(p_first text, p_last text, p_phone text, p_email text, p_city text, p_birth date, p_link boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_store uuid; v_org uuid; v_dup crm.customers%rowtype; v_id uuid; v_no bigint; v_same boolean;
begin
  if not crm.has_perm('customers.register') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  select s into v_store from crm.my_store_ids() s order by s limit 1;
  if v_store is null then raise exception 'Hesabınız bir mağazaya bağlı değil'; end if;
  p_first := btrim(coalesce(p_first, '')); p_last := btrim(coalesce(p_last, ''));
  p_phone := nullif(btrim(coalesce(p_phone, '')), ''); p_email := nullif(btrim(coalesce(p_email, '')), '');
  if p_first = '' then raise exception 'Ad gerekli'; end if;
  if p_phone is null and p_email is null then raise exception 'Telefon veya e-posta gerekli'; end if;
  if length(p_first) > 80 or length(p_last) > 80 or length(coalesce(p_phone,'')) > 30 or length(coalesce(p_email,'')) > 120 or length(coalesce(p_city,'')) > 60 then raise exception 'Alan çok uzun'; end if;
  select c.* into v_dup from crm.customers c
   where c.status = 'active' and ((crm.norm_phone(p_phone) is not null and c.phone_norm = crm.norm_phone(p_phone)) or (crm.norm_email(p_email) is not null and c.email_norm = crm.norm_email(p_email)))
   limit 1;
  if found then
    v_same := v_dup.store_id = v_store or exists (select 1 from crm.customer_stores cs where cs.customer_id = v_dup.id and cs.store_id = v_store);
    if p_link and not v_same then
      insert into crm.customer_stores (customer_id, store_id, linked_by) values (v_dup.id, v_store, auth.uid()) on conflict do nothing;
      return jsonb_build_object('status', 'linked');
    end if;
    return jsonb_build_object('status', 'duplicate', 'same_store', v_same,
      'name', case when v_same then btrim(v_dup.first_name || ' ' || v_dup.last_name)
                   else left(v_dup.first_name, 1) || repeat('*', greatest(length(v_dup.first_name) - 1, 1)) || ' ' || left(v_dup.last_name, 1) || repeat('*', greatest(length(v_dup.last_name) - 1, 0)) end,
      'store', (select name from crm.stores where id = v_dup.store_id), 'no', v_dup.customer_no);
  end if;
  select organization_id into v_org from crm.stores where id = v_store;
  insert into crm.customers (organization_id, store_id, first_name, last_name, phone, email, source, city, birth_date, created_by)
  values (v_org, v_store, p_first, p_last, p_phone, p_email, 'walk_in', nullif(btrim(coalesce(p_city, '')), ''), p_birth, auth.uid())
  returning id, customer_no into v_id, v_no;
  return jsonb_build_object('status', 'created', 'id', v_id, 'no', v_no);
end $$;

-- Kayıt öncesi anlık kontrol (yalnızca var/yok bilgisi, kişi bilgisi vermez)
create or replace function crm.check_customer_exists(p_phone text, p_email text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_store uuid; v_dup crm.customers%rowtype; v_same boolean;
begin
  if not crm.has_perm('customers.register') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  select s into v_store from crm.my_store_ids() s order by s limit 1;
  select c.* into v_dup from crm.customers c
   where c.status = 'active' and ((crm.norm_phone(p_phone) is not null and c.phone_norm = crm.norm_phone(p_phone)) or (crm.norm_email(p_email) is not null and c.email_norm = crm.norm_email(p_email))) limit 1;
  if not found then return jsonb_build_object('exists', false); end if;
  v_same := v_dup.store_id = v_store or exists (select 1 from crm.customer_stores cs where cs.customer_id = v_dup.id and cs.store_id = v_store);
  return jsonb_build_object('exists', true, 'same_store', v_same,
    'name', case when v_same then btrim(v_dup.first_name || ' ' || v_dup.last_name)
                 else left(v_dup.first_name, 1) || repeat('*', greatest(length(v_dup.first_name) - 1, 1)) || ' ' || left(v_dup.last_name, 1) || repeat('*', greatest(length(v_dup.last_name) - 1, 0)) end);
end $$;

-- Arama: yalnızca kendi mağazasının (veya mağazasına bağlı) müşterileri, sınırlı alanlar, en fazla 20 sonuç
create or replace function crm.staff_search_customers(p_q text) returns table (id uuid, customer_no bigint, name text, phone text, city text, birth_date date)
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := btrim(coalesce(p_q, '')); v_digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  if not crm.has_perm('customers.search') then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  if length(v_q) < 3 then return; end if;
  return query
    select c.id, c.customer_no, btrim(c.first_name || ' ' || c.last_name), c.phone, c.city, c.birth_date
    from crm.customers c
    where c.status = 'active'
      and (c.store_id in (select crm.my_store_ids()) or exists (select 1 from crm.customer_stores cs where cs.customer_id = c.id and cs.store_id in (select crm.my_store_ids())))
      and (c.search_text ilike '%' || replace(replace(lower(v_q), '%', ' '), '_', ' ') || '%'
           or (length(v_digits) >= 4 and c.phone_norm like '%' || v_digits || '%'))
    order by c.registered_at desc limit 20;
end $$;

revoke execute on function crm.register_customer(text, text, text, text, text, date, boolean), crm.check_customer_exists(text, text), crm.staff_search_customers(text) from public, anon;
grant execute on function crm.register_customer(text, text, text, text, text, date, boolean), crm.check_customer_exists(text, text), crm.staff_search_customers(text) to authenticated;
