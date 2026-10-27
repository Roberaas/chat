-- Gerçek kampanya gönderimi: kuyruk, izin yeniden kontrolü, saat penceresi, günlük limit, İYS eşitleme kuyruğu, ret (STOP) işleme
alter table crm.campaign_recipients drop constraint if exists campaign_recipients_status_check;
alter table crm.campaign_recipients add constraint campaign_recipients_status_check
  check (status in ('pending','sending','sent','delivered','failed','skipped_no_consent'));
alter table crm.campaign_recipients add column to_address text;
alter table crm.campaign_recipients add column provider_message_id text;
alter table crm.campaign_recipients add column attempts int not null default 0;
alter table crm.campaign_recipients add column locked_at timestamptz;
create index campaign_recipients_status_idx on crm.campaign_recipients (campaign_id, status);
create index campaign_recipients_sent_idx on crm.campaign_recipients (sent_at) where sent_at is not null;

insert into crm.system_settings (key, value) values
  ('messaging', '{"window_start":"09:00","window_end":"20:00","daily_cap":2000,"max_attempts":3}')
on conflict do nothing;

create function crm.campaign_claim(p_campaign uuid, p_limit int default 100)
returns table (customer_id uuid, first_name text, last_name text, to_address text, channel text, subject text, body text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v crm.campaigns; t crm.message_templates; s jsonb; w_start time; w_end time; v_now time; v_cap int; v_max int; v_used int; v_take int; r record; v_addr text; v_ok boolean;
begin
  if auth.uid() is null or not crm.is_active_user() or not crm.has_perm('campaigns.send') then raise exception 'Gönderim yetkiniz yok' using errcode = '42501'; end if;
  select * into v from crm.campaigns where id = p_campaign for update;
  if v.id is null then raise exception 'Kampanya bulunamadı'; end if;
  if v.status not in ('ready','sending') then raise exception 'Kampanya gönderime hazır değil (önce "Hazır" yapın)'; end if;
  if v.scheduled_at is not null and v.scheduled_at > now() then raise exception 'Planlanan zaman henüz gelmedi'; end if;
  select * into t from crm.message_templates where id = v.template_id and is_active;
  if t.id is null then raise exception 'Şablon bulunamadı veya pasif'; end if;
  select value into s from crm.system_settings where key = 'messaging';
  w_start := coalesce((s->>'window_start')::time, '09:00'); w_end := coalesce((s->>'window_end')::time, '20:00');
  v_cap := coalesce((s->>'daily_cap')::int, 2000); v_max := coalesce((s->>'max_attempts')::int, 3);
  v_now := (now() at time zone 'Europe/Istanbul')::time;
  if v_now < w_start or v_now >= w_end then raise exception 'Ticari ileti gönderim saati dışında (% - %, Türkiye saati)', to_char(w_start, 'HH24:MI'), to_char(w_end, 'HH24:MI'); end if;
  select count(*) into v_used from crm.campaign_recipients cr join crm.campaigns c on c.id = cr.campaign_id
   where c.channel = v.channel and (cr.status = 'sending' or cr.sent_at >= date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul');
  v_take := least(greatest(p_limit, 1), 200, v_cap - v_used);
  if v_take <= 0 then raise exception 'Günlük gönderim limitine ulaşıldı (%)', v_cap; end if;

  update crm.campaigns set status = 'sending' where id = p_campaign and status <> 'sending';
  update crm.campaign_recipients cr set status = case when cr.attempts >= v_max then 'failed' else 'pending' end,
         error = case when cr.attempts >= v_max then coalesce(cr.error, 'Zaman aşımı') else cr.error end
   where cr.campaign_id = p_campaign and cr.status = 'sending' and cr.locked_at < now() - interval '10 minutes';

  for r in
    select cr.customer_id as cid, c.first_name as fn, c.last_name as ln, c.phone as ph, c.email as em, c.status as cstatus
      from crm.campaign_recipients cr join crm.customers c on c.id = cr.customer_id
     where cr.campaign_id = p_campaign and cr.status = 'pending'
     order by cr.customer_id limit v_take for update of cr skip locked
  loop
    v_ok := r.cstatus = 'active' and exists (select 1 from crm.customer_consents k where k.customer_id = r.cid and k.channel = v.channel and k.purpose = 'marketing' and k.status = 'granted');
    if not v_ok then
      update crm.campaign_recipients set status = 'skipped_no_consent', error = 'Gönderim anında izin yok' where campaign_id = p_campaign and campaign_recipients.customer_id = r.cid;
      continue;
    end if;
    v_addr := case when v.channel = 'email' then crm.norm_email(r.em) else (select case when crm.norm_phone(r.ph) is null then null else '+90' || crm.norm_phone(r.ph) end) end;
    if v_addr is null then
      update crm.campaign_recipients set status = 'failed', error = 'Geçerli adres yok' where campaign_id = p_campaign and campaign_recipients.customer_id = r.cid;
      continue;
    end if;
    update crm.campaign_recipients set status = 'sending', locked_at = now(), attempts = attempts + 1, to_address = v_addr
     where campaign_id = p_campaign and campaign_recipients.customer_id = r.cid;
    customer_id := r.cid; first_name := r.fn; last_name := r.ln; to_address := v_addr; channel := v.channel; subject := t.subject; body := t.body;
    return next;
  end loop;

  if not exists (select 1 from crm.campaign_recipients where campaign_id = p_campaign and status in ('pending','sending')) then
    update crm.campaigns set status = 'done' where id = p_campaign;
  end if;
end $$;

create function crm.campaign_mark(p_campaign uuid, p_customer uuid, p_ok boolean, p_retry boolean, p_error text, p_message_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_att int; v_max int;
begin
  if auth.uid() is null or not crm.is_active_user() or not crm.has_perm('campaigns.send') then raise exception 'Gönderim yetkiniz yok' using errcode = '42501'; end if;
  select coalesce((value->>'max_attempts')::int, 3) into v_max from crm.system_settings where key = 'messaging';
  select attempts into v_att from crm.campaign_recipients where campaign_id = p_campaign and customer_id = p_customer and status = 'sending';
  if v_att is null then return; end if;
  if p_ok then
    update crm.campaign_recipients set status = 'sent', sent_at = now(), error = null, provider_message_id = left(p_message_id, 200), locked_at = null
     where campaign_id = p_campaign and customer_id = p_customer;
  elsif p_retry and v_att < coalesce(v_max, 3) then
    update crm.campaign_recipients set status = 'pending', error = left(p_error, 300), locked_at = null where campaign_id = p_campaign and customer_id = p_customer;
  else
    update crm.campaign_recipients set status = 'failed', sent_at = now(), error = left(coalesce(p_error, 'Hata'), 300), locked_at = null where campaign_id = p_campaign and customer_id = p_customer;
  end if;
  if not exists (select 1 from crm.campaign_recipients where campaign_id = p_campaign and status in ('pending','sending')) then
    update crm.campaigns set status = 'done' where id = p_campaign and status = 'sending';
  end if;
end $$;
revoke execute on function crm.campaign_claim(uuid, int), crm.campaign_mark(uuid, uuid, boolean, boolean, text, text) from public, anon;
grant execute on function crm.campaign_claim(uuid, int), crm.campaign_mark(uuid, uuid, boolean, boolean, text, text) to authenticated;

-- Alıcı yanıtı "STOP / IPTAL" veya e-posta çıkışı: pazarlama izni iptal edilir (yalnız sunucu/admin çağırır)
create function crm.opt_out(p_channel text, p_phone text, p_email text, p_source text default 'other')
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_channel not in ('sms','email','whatsapp','call') then raise exception 'Geçersiz kanal'; end if;
  with hit as (
    select k.id from crm.customer_consents k join crm.customers c on c.id = k.customer_id
     where k.channel = p_channel and k.purpose = 'marketing' and k.status <> 'revoked'
       and ((p_phone is not null and crm.norm_phone(p_phone) is not null and c.phone_norm = crm.norm_phone(p_phone))
         or (p_email is not null and crm.norm_email(p_email) is not null and c.email_norm = crm.norm_email(p_email))))
  update crm.customer_consents k set status = 'revoked', source = case when p_source in ('store_form','web','iys','verbal','import','other') then p_source else 'other' end
   from hit where k.id = hit.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function crm.opt_out(text, text, text, text) from public, anon, authenticated;

-- İzin değişince İYS eşitleme bekler
create function crm.consent_iys_reset() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.iys_sync = old.iys_sync and new.channel in ('sms','email','call') then new.iys_sync := 'not_synced'; end if;
  return new;
end $$;
create trigger consent_iys_reset_bu before update on crm.customer_consents for each row execute function crm.consent_iys_reset();
revoke execute on function crm.consent_iys_reset() from public, anon, authenticated;

-- İYS'e gönderilecek bekleyen değişiklikler (yalnız sunucu)
create function crm.iys_pending(p_limit int default 200)
returns table (consent_id uuid, channel text, status text, phone text, email text, changed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.id, k.channel, k.status, c.phone, c.email, k.updated_at
    from crm.customer_consents k join crm.customers c on c.id = k.customer_id
   where k.purpose = 'marketing' and k.channel in ('sms','email','call') and k.iys_sync in ('not_synced','failed') and k.status in ('granted','revoked')
   order by k.updated_at limit least(p_limit, 500)
$$;
create function crm.iys_mark(p_ids uuid[], p_ok boolean) returns void language sql security definer set search_path = '' as $$
  update crm.customer_consents set iys_sync = case when p_ok then 'synced' else 'failed' end where id = any(p_ids)
$$;
revoke execute on function crm.iys_pending(int), crm.iys_mark(uuid[], boolean) from public, anon, authenticated;
