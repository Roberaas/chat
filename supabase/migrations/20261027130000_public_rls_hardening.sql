alter table public.otp_codes enable row level security;
alter table public.kalimero_webhook_events enable row level security;
alter table public.arama_logu enable row level security;
revoke all on public.otp_codes, public.kalimero_webhook_events, public.arama_logu from anon, authenticated;
revoke execute on function public.sms_zamanli_gonder() from public, anon, authenticated;
alter function public.sms_zamanli_gonder() set search_path = public, pg_temp;
