-- CRM modül anahtarları: varsayılan KAPALI. Yönetici Ayarlar'dan açıp kapatır. Veri modülleri (müşteri, sipariş, ürün, B2B, cari...) hep açıktır.
create table if not exists crm.module_settings (
  module text primary key,
  enabled boolean not null default false,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table crm.module_settings enable row level security;
grant select, insert, update on crm.module_settings to authenticated;
grant all on crm.module_settings to service_role;
create policy ms_sel on crm.module_settings for select to authenticated using (true);
create policy ms_ins on crm.module_settings for insert to authenticated with check ((select crm.is_super_admin()) or (select crm.has_perm('settings.manage')));
create policy ms_upd on crm.module_settings for update to authenticated using ((select crm.is_super_admin()) or (select crm.has_perm('settings.manage')))
  with check ((select crm.is_super_admin()) or (select crm.has_perm('settings.manage')));
insert into crm.module_settings (module, enabled) values
  ('reports', false), ('sales', false), ('tasks', false), ('service', false), ('marketing', false), ('automation', false), ('activity', false)
on conflict do nothing;

create or replace function crm.module_on(p text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select enabled from crm.module_settings where module = p), true)
$$;
revoke execute on function crm.module_on(text) from public, anon;
grant execute on function crm.module_on(text) to authenticated, service_role;

-- Arka plan işleri: ilgili modül kapalıysa çalışmaz (gelen entegrasyon verisi işlenmeye devam eder)
select cron.alter_job((select jobid from cron.job where jobname = 'crm_due_notifications'), command := $c$select case when crm.module_on('tasks') then crm.generate_due_notifications() end$c$);
select cron.alter_job((select jobid from cron.job where jobname = 'crm_daily_digest'), command := $c$select case when crm.module_on('tasks') then crm.daily_digest() end$c$);
select cron.alter_job((select jobid from cron.job where jobname = 'crm_birthday_notifications'), command := $c$select case when crm.module_on('marketing') then crm.birthday_notifications() end$c$);
select cron.alter_job((select jobid from cron.job where jobname = 'crm_process_queues'), command := $c$select case when crm.module_on('automation') then crm.process_outbox() end; select crm.process_inbox();$c$);
