create table if not exists public.crm_otp (
  user_id uuid primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  sent_at timestamptz not null default now()
);
alter table public.crm_otp enable row level security;
revoke all on public.crm_otp from anon, authenticated, public;
grant all on public.crm_otp to service_role;
-- süper yönetici telefonu: paneldeki kayıtlı yönetici numarasından (yalnızca boşsa)
update crm.profiles p set phone = k.telefon
from public.kullanicilar k
where k.kullanici_adi = 'kerem' and p.email = 'kerem@robertobravo.com' and (p.phone is null or p.phone = '');
