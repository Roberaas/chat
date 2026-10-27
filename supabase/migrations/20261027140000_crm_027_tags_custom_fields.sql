-- Müşteri etiketleri ve özel alanlar
insert into crm.permissions (code, module, description) values
  ('tags.manage', 'customers', 'Etiketleri yeniden adlandır / sil')
on conflict do nothing;
insert into crm.role_permissions (role_code, permission_code)
select r, 'tags.manage' from unnest(array['super_admin','executive','crm_marketing','store_manager','dealer_admin']) r
where exists (select 1 from crm.roles where code = r) on conflict do nothing;

create table crm.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'violet' check (color in ('violet','blue','green','amber','red','gray')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index tags_name_uidx on crm.tags (lower(btrim(name)));

create table crm.customer_tags (
  customer_id uuid not null references crm.customers(id) on delete cascade,
  tag_id uuid not null references crm.tags(id) on delete cascade,
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);
create index customer_tags_tag_idx on crm.customer_tags (tag_id);

create table crm.custom_fields (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  field_type text not null check (field_type in ('text','number','date','select','boolean')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table crm.customers add column custom jsonb not null default '{}'::jsonb;
alter table crm.customers add constraint customers_custom_obj check (jsonb_typeof(custom) = 'object');

alter table crm.tags enable row level security;
alter table crm.customer_tags enable row level security;
alter table crm.custom_fields enable row level security;
grant select, insert, update, delete on crm.tags, crm.customer_tags, crm.custom_fields to authenticated;

create policy tags_sel on crm.tags for select to authenticated using ((select crm.has_perm('customers.read')));
create policy tags_ins on crm.tags for insert to authenticated with check ((select crm.has_perm('customers.write')));
create policy tags_upd on crm.tags for update to authenticated using ((select crm.has_perm('tags.manage'))) with check ((select crm.has_perm('tags.manage')));
create policy tags_del on crm.tags for delete to authenticated using ((select crm.has_perm('tags.manage')));
create policy ctags_sel on crm.customer_tags for select to authenticated using (
  (select crm.has_perm('customers.read')) and customer_id in (select id from crm.customers));
create policy ctags_ins on crm.customer_tags for insert to authenticated with check (
  (select crm.has_perm('customers.write')) and crm.can_access_customer(customer_id));
create policy ctags_del on crm.customer_tags for delete to authenticated using (
  (select crm.has_perm('customers.write')) and crm.can_access_customer(customer_id));
create policy cf_sel on crm.custom_fields for select to authenticated using ((select crm.has_perm('customers.read')));
create policy cf_w on crm.custom_fields for all to authenticated using ((select crm.has_perm('settings.manage'))) with check ((select crm.has_perm('settings.manage')));

create trigger audit_tags after insert or update or delete on crm.tags for each row execute function crm.audit_trigger_min();
create trigger audit_customer_tags after insert or delete on crm.customer_tags for each row execute function crm.audit_trigger_min();
create trigger audit_custom_fields after insert or update or delete on crm.custom_fields for each row execute function crm.audit_trigger_min();

-- Özel alan değerleri tanıma uymalı (bilinmeyen anahtar / tür uyuşmazlığı reddedilir)
create function crm.customers_custom_check() returns trigger language plpgsql set search_path = '' as $$
declare k text; v jsonb; d crm.custom_fields;
begin
  if new.custom = '{}'::jsonb then return new; end if;
  if tg_op = 'UPDATE' and new.custom = old.custom then return new; end if;
  for k, v in select * from jsonb_each(new.custom) loop
    select * into d from crm.custom_fields where key = k;
    if d.id is null then raise exception 'Tanımsız özel alan: %', k; end if;
    if not d.is_active then continue; end if;
    if v = 'null'::jsonb or v = '""'::jsonb then continue; end if;
    if d.field_type = 'number' and jsonb_typeof(v) <> 'number' then raise exception '% sayı olmalı', d.label; end if;
    if d.field_type = 'boolean' and jsonb_typeof(v) <> 'boolean' then raise exception '% evet/hayır olmalı', d.label; end if;
    if d.field_type in ('text','date','select') and jsonb_typeof(v) <> 'string' then raise exception '% metin olmalı', d.label; end if;
    if d.field_type = 'text' and char_length(v #>> '{}') > 500 then raise exception '% en fazla 500 karakter', d.label; end if;
    if d.field_type = 'date' and (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '% tarih olmalı (YYYY-AA-GG)', d.label; end if;
    if d.field_type = 'select' and not (d.options ? (v #>> '{}')) then raise exception '% için geçersiz seçenek', d.label; end if;
  end loop;
  return new;
end $$;
create trigger customers_custom_chk before insert or update of custom on crm.customers for each row execute function crm.customers_custom_check();
revoke execute on function crm.customers_custom_check() from public, anon, authenticated;

-- Segment kuralları: etiket ve özel alan
create or replace function crm.segment_query(p_rules jsonb) returns setof uuid
language sql stable security invoker set search_path = '' as $$
  select c.id from crm.customers c
  where c.status = 'active'
    and (p_rules->>'vip' is null or c.is_vip = (p_rules->>'vip')::boolean)
    and (p_rules->>'store_id' is null or c.store_id = (p_rules->>'store_id')::uuid)
    and (p_rules->>'assigned_to' is null or c.assigned_to = (p_rules->>'assigned_to')::uuid)
    and (p_rules->>'min_spent' is null or c.total_spent >= (p_rules->>'min_spent')::numeric)
    and (p_rules->>'max_spent' is null or c.total_spent <= (p_rules->>'max_spent')::numeric)
    and (p_rules->>'min_orders' is null or c.order_count >= (p_rules->>'min_orders')::int)
    and (p_rules->>'inactive_days' is null or c.last_purchase_at is null
         or c.last_purchase_at < now() - make_interval(days => (p_rules->>'inactive_days')::int))
    and (p_rules->>'registered_within_days' is null
         or c.registered_at >= now() - make_interval(days => (p_rules->>'registered_within_days')::int))
    and (p_rules->>'source' is null or c.source = p_rules->>'source')
    and (p_rules->>'city' is null or lower(c.city) = lower(p_rules->>'city'))
    and (p_rules->>'birthday_month' is null or extract(month from c.birth_date) = (p_rules->>'birthday_month')::int)
    and (p_rules->>'consent_channel' is null or exists (
          select 1 from crm.customer_consents k
          where k.customer_id = c.id and k.channel = p_rules->>'consent_channel'
            and k.purpose = 'marketing' and k.status = 'granted'))
    and (p_rules->>'tag_id' is null or exists (
          select 1 from crm.customer_tags t where t.customer_id = c.id and t.tag_id = (p_rules->>'tag_id')::uuid))
    and (p_rules->>'custom_key' is null or c.custom ->> (p_rules->>'custom_key') = p_rules->>'custom_value')
$$;

grant insert (custom), update (custom) on crm.customers to authenticated;
