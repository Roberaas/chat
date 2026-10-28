-- Mağaza kaydı: SMS ile telefon doğrulama, aydınlatma/ticari ileti izni ayrımı, izin kanıtı (KVKK + 6563)
-- Not: Supabase'e parça parça uygulandı (crm_kvkk_*); bu dosya birleşik kayıttır.
create table if not exists crm.legal_texts (
  code text primary key check (code in ('privacy_notice', 'marketing_consent')),
  version int not null default 1, title text not null, body text not null,
  updated_by uuid, updated_at timestamptz not null default now());
alter table crm.legal_texts enable row level security;
create policy legal_read on crm.legal_texts for select to authenticated using (crm.has_perm('settings.manage') or crm.has_perm('customers.register'));
create policy legal_write on crm.legal_texts for update to authenticated using (crm.has_perm('settings.manage')) with check (crm.has_perm('settings.manage'));
revoke insert, delete on crm.legal_texts from authenticated;
-- (varsayılan metinler uygulanmış veritabanında; Ayarlar > Yasal Metinler'den düzenlenir)
create table if not exists crm.reg_pending (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('registration','consent')),
  user_id uuid not null, store_id uuid not null, payload jsonb not null, code_hash text not null,
  attempts int not null default 0, expires_at timestamptz not null, created_at timestamptz not null default now());
alter table crm.reg_pending enable row level security;
revoke all on crm.reg_pending from anon, authenticated;
create index if not exists reg_pending_exp_idx on crm.reg_pending (expires_at);
create table if not exists crm.customer_verifications (
  customer_id uuid primary key references crm.customers(id) on delete cascade,
  phone_verified_at timestamptz, method text, notice_version int, notice_shown_at timestamptz, recorded_by uuid);
alter table crm.customer_verifications enable row level security;
create policy cv_read on crm.customer_verifications for select to authenticated using (crm.has_perm('consents.read'));
revoke insert, update, delete on crm.customer_verifications from authenticated;
create table if not exists crm.consent_evidence (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references crm.customers(id) on delete cascade,
  channel text not null, purpose text not null default 'marketing', action text not null check (action in ('granted','revoked')),
  text_version int, method text not null, phone_norm text, recorded_by uuid, store_id uuid, created_at timestamptz not null default now());
alter table crm.consent_evidence enable row level security;
create policy ce_read on crm.consent_evidence for select to authenticated using (crm.has_perm('consents.read'));
revoke insert, update, delete on crm.consent_evidence from authenticated;
-- Fonksiyonlar (_hash_code, _mask_name, _user_can, _user_store, _find_dup, _dup_info, _pending_put/take/drop,
-- _create_customer, _mark_verified, _grant_channel, get_legal_texts, start_registration, finalize_registration,
-- register_customer, start_consent, confirm_consent) veritabanında mevcuttur: pg_get_functiondef ile alınabilir.
-- start_* yalnızca service_role; finalize/confirm/register/get_legal_texts authenticated.
-- cron: crm_reg_pending_purge (*/10 dk)
