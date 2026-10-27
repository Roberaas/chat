-- crm fonksiyonları yalnızca giriş yapmış kullanıcı ve sunucu için çalıştırılabilir (anon/PUBLIC kapalı)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'crm' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
alter default privileges in schema crm revoke execute on functions from public, anon;

-- Panel tabloları: anon yalnızca gereken yetkiyi taşır (RLS'ye ek savunma katmanı)
revoke all on public.kullanicilar, public.aktivite_log, public.ekip_notlari, public.gorevler, public.etiketler, public.push_subscriptions from anon, authenticated;
revoke all on public.wa_sessions_roberto, public.gunluk_satis from anon, authenticated;
grant select, insert, update on public.wa_sessions_roberto, public.gunluk_satis to anon;

-- OTP: yanlış deneme sayacı (kaba kuvvet koruması sunucudan bağımsız, veritabanında)
alter table public.otp_codes add column if not exists attempts int not null default 0;
