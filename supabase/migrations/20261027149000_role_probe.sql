-- Geçici gözlem: botun (n8n) tabloya hangi rolle yazdığını kaydeder. Davranışı değiştirmez, hata vermez.
create table if not exists public.role_probe (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  tbl text, op text, db_role text, jwt_role text
);
alter table public.role_probe enable row level security;
revoke all on public.role_probe from anon, authenticated;
create or replace function public.role_probe_fn() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    insert into public.role_probe (tbl, op, db_role, jwt_role)
    values (tg_table_name, tg_op, session_user, coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'none'));
  exception when others then null;
  end;
  return null;
end $$;
revoke all on function public.role_probe_fn() from public, anon, authenticated;
drop trigger if exists role_probe_wa on public.wa_sessions_roberto;
create trigger role_probe_wa after insert or update on public.wa_sessions_roberto for each statement execute function public.role_probe_fn();
drop trigger if exists role_probe_gs on public.gunluk_satis;
create trigger role_probe_gs after insert or update on public.gunluk_satis for each statement execute function public.role_probe_fn();
