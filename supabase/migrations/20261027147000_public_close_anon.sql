-- Panel tabloları yalnızca sunucu (servis anahtarı) üzerinden erişilir; anonim/herkese açık politikalar kaldırıldı.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public'
              and tablename in ('kullanicilar','aktivite_log','ekip_notlari','gorevler','etiketler','push_subscriptions')
  loop execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename); end loop;
end $$;
-- gunluk_satis: herkese açık "ALL" (silme dahil) kalktı; n8n'in kullanabildiği select/insert/update kaldı
drop policy if exists allow_all on public.gunluk_satis;
-- WhatsApp oturumları: silme kapatıldı, CRM kullanıcıları (authenticated) erişemez; bot için anon select/insert/update kaldı
drop policy if exists anon_delete on public.wa_sessions_roberto;
drop policy anon_select on public.wa_sessions_roberto;
drop policy anon_insert on public.wa_sessions_roberto;
drop policy anon_update on public.wa_sessions_roberto;
create policy anon_select on public.wa_sessions_roberto for select to anon using (true);
create policy anon_insert on public.wa_sessions_roberto for insert to anon with check (true);
create policy anon_update on public.wa_sessions_roberto for update to anon using (true) with check (true);
