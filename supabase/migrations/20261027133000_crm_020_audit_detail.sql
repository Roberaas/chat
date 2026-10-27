-- Denetim ayrıntısı: hangi alan eski → yeni değere değişti, kayıt etiketi (ad/başlık/no)
create or replace function crm.audit_label(j jsonb) returns text
language sql immutable set search_path = '' as $$
  select nullif(btrim(coalesce(
    j->>'name', j->>'title', j->>'order_no', j->>'sku', j->>'code', j->>'email',
    btrim(coalesce(j->>'first_name','') || ' ' || coalesce(j->>'last_name','')), '')), '')
$$;

create or replace function crm.audit_trigger_min() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_new jsonb; v_old jsonb; v_row jsonb; v_changed text[]; v_diff jsonb;
begin
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  v_row := coalesce(v_new, v_old);
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed from jsonb_object_keys(v_new) k
     where (v_new -> k) is distinct from (v_old -> k) and k not in ('updated_at','search_text');
    if v_changed is null then return null; end if;
    select jsonb_object_agg(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k)) into v_diff
      from unnest(v_changed) k;
  end if;
  insert into crm.audit_logs (actor_id, action, table_name, record_id, store_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name, coalesce(v_row->>'id', v_row->>'customer_id'),
          nullif(v_row->>'store_id','')::uuid,
          case when tg_op = 'DELETE' then v_old - 'search_text' end,
          case tg_op
            when 'UPDATE' then jsonb_build_object('changed', to_jsonb(v_changed), 'diff', v_diff, 'label', crm.audit_label(v_row))
            when 'INSERT' then (v_new - 'search_text') || jsonb_build_object('label', crm.audit_label(v_row))
          end);
  return null;
end $$;

drop function if exists crm.activity_feed(integer, bigint, uuid, text, uuid, timestamptz, timestamptz);
create function crm.activity_feed(p_limit integer default 100, p_before bigint default null, p_actor uuid default null, p_table text default null, p_store uuid default null, p_from timestamptz default null, p_to timestamptz default null)
returns table(id bigint, created_at timestamptz, actor_id uuid, actor_name text, actor_roles text, action text, table_name text, record_id text, store_id uuid, store_name text, changed text[], label text, detail jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (crm.has_perm('activity.read') or crm.has_perm('audit.read')) then raise exception 'Yetkiniz yok' using errcode = '42501'; end if;
  return query
  select a.id, a.created_at, a.actor_id,
         coalesce(p.first_name || ' ' || p.last_name, 'Sistem'),
         (select string_agg(ur.role_code, ',') from crm.user_roles ur where ur.user_id = a.actor_id),
         a.action, a.table_name, a.record_id, a.store_id, s.name,
         case when a.new_data ? 'changed' then (select array_agg(k) from jsonb_array_elements_text(a.new_data -> 'changed') k) end,
         coalesce(a.new_data ->> 'label', crm.audit_label(coalesce(a.new_data, a.old_data))),
         case
           when a.new_data ? 'diff' then a.new_data -> 'diff'
           when a.action = 'UPDATE' and a.old_data is not null and a.new_data is not null then
             (select jsonb_object_agg(k, jsonb_build_object('old', a.old_data -> k, 'new', a.new_data -> k))
                from jsonb_object_keys(a.new_data) k
               where (a.new_data -> k) is distinct from (a.old_data -> k) and k not in ('updated_at','search_text'))
           when a.action = 'INSERT' then a.new_data - 'search_text' - 'label'
           when a.action = 'DELETE' then a.old_data - 'search_text'
         end
    from crm.audit_logs a
    left join crm.profiles p on p.id = a.actor_id
    left join crm.stores s on s.id = a.store_id
   where (p_before is null or a.id < p_before)
     and (p_actor is null or a.actor_id = p_actor)
     and (p_table is null or a.table_name = p_table)
     and (p_store is null or a.store_id = p_store)
     and (p_from is null or a.created_at >= p_from)
     and (p_to is null or a.created_at <= p_to)
     and a.table_name not in ('role_permissions')
   order by a.id desc
   limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function crm.activity_feed(integer, bigint, uuid, text, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function crm.activity_feed(integer, bigint, uuid, text, uuid, timestamptz, timestamptz) to authenticated;
