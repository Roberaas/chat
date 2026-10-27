-- CRM Aşama 12: B2B / bayi (müşteri tablolarından ayrı; mağaza personeline otomatik erişim YOK)
create table crm.business_accounts (
  id uuid primary key default gen_random_uuid(),
  account_no bigint generated always as identity unique,
  name text not null,
  type text not null default 'dealer' check (type in ('dealer','corporate','wholesale')),
  status text not null default 'active' check (status in ('prospect','active','suspended','closed')),
  tax_office text,
  tax_no text,
  city text,
  phone text,
  email text,
  owner_id uuid references crm.profiles(id) on delete set null,
  notes text,
  source_system text,
  source_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index business_accounts_tax_uq on crm.business_accounts (tax_no) where tax_no is not null;
create unique index business_accounts_source_uq on crm.business_accounts (source_system, source_id) where source_system is not null;
create index business_accounts_name_trgm on crm.business_accounts using gin (name extensions.gin_trgm_ops);

create table crm.business_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references crm.business_accounts(id) on delete cascade,
  full_name text not null,
  title text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index business_contacts_account_idx on crm.business_contacts (account_id);

create table crm.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references crm.business_accounts(id) on delete cascade,
  title text not null,
  stage text not null default 'lead' check (stage in ('lead','negotiation','quote','won','lost')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'TRY',
  expected_close_date date,
  lost_reason text,
  owner_id uuid references crm.profiles(id) on delete set null,
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_opps_account_idx on crm.business_opportunities (account_id);

create function crm.b2b_before() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  if tg_table_name = 'business_opportunities' then
    if new.stage = 'lost' and coalesce(btrim(new.lost_reason), '') = '' then raise exception 'Kaybedilen fırsat için neden zorunlu'; end if;
    if new.stage in ('won','lost') then new.closed_at := coalesce(new.closed_at, now()); else new.closed_at := null; new.lost_reason := null; end if;
  end if;
  return new;
end $$;
create trigger b2b_accounts_biu before insert or update on crm.business_accounts for each row execute function crm.b2b_before();
create trigger b2b_opps_biu before insert or update on crm.business_opportunities for each row execute function crm.b2b_before();
create trigger b2b_accounts_updated before update on crm.business_accounts for each row execute function crm.set_updated_at();
create trigger b2b_opps_updated before update on crm.business_opportunities for each row execute function crm.set_updated_at();
create trigger audit_b2b_accounts after insert or update or delete on crm.business_accounts for each row execute function crm.audit_trigger_min();
create trigger audit_b2b_opps after insert or update or delete on crm.business_opportunities for each row execute function crm.audit_trigger_min();

alter table crm.business_accounts enable row level security;
alter table crm.business_contacts enable row level security;
alter table crm.business_opportunities enable row level security;

-- Erişim yalnızca b2b.* yetkisiyle (b2b_manager, super_admin; executive salt-okunur). Mağaza rolleri b2b.* almaz.
create policy ba_sel on crm.business_accounts for select to authenticated using ((select crm.has_perm('b2b.read')));
create policy ba_w on crm.business_accounts for all to authenticated
  using ((select crm.has_perm('b2b.write'))) with check ((select crm.has_perm('b2b.write')));
create policy bc_sel on crm.business_contacts for select to authenticated using ((select crm.has_perm('b2b.read')));
create policy bc_w on crm.business_contacts for all to authenticated
  using ((select crm.has_perm('b2b.write'))) with check ((select crm.has_perm('b2b.write')));
create policy bo_sel on crm.business_opportunities for select to authenticated using ((select crm.has_perm('b2b.read')));
create policy bo_w on crm.business_opportunities for all to authenticated
  using ((select crm.has_perm('b2b.write'))) with check ((select crm.has_perm('b2b.write')));
