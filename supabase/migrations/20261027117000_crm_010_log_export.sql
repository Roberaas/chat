create function crm.log_export(p_what text, p_count int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not crm.is_active_user() or not (crm.has_perm('customers.export') or crm.has_perm('reports.export')) then
    raise exception 'Yetkiniz yok' using errcode = '42501';
  end if;
  insert into crm.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'EXPORT', p_what, null, jsonb_build_object('count', p_count));
end $$;
revoke execute on function crm.log_export(text, int) from public, anon;
