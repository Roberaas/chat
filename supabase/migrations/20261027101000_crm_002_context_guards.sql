-- CRM: kullanıcı bağlamı (me), zorunlu parola değişimi, son Super Admin koruması

alter table crm.profiles add column must_change_password boolean not null default true;

-- SECURITY INVOKER: RLS çağıran kullanıcıya göre uygulanır
create function crm.me() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from crm.profiles p where p.id = auth.uid()),
    'roles', coalesce((select jsonb_agg(ur.role_code) from crm.user_roles ur where ur.user_id = auth.uid()), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission_code)
        from crm.user_roles ur join crm.role_permissions rp on rp.role_code = ur.role_code
        where ur.user_id = auth.uid()), '[]'::jsonb),
    'store_ids', coalesce((select jsonb_agg(sm.store_id) from crm.store_memberships sm where sm.user_id = auth.uid()), '[]'::jsonb),
    'scope', (select case when bool_or(r.scope = 'all') then 'all' when bool_or(r.scope = 'stores') then 'stores' else 'own' end
        from crm.user_roles ur join crm.roles r on r.code = ur.role_code where ur.user_id = auth.uid())
  )
$$;

create function crm.guard_last_super_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_other boolean;
begin
  if tg_table_name = 'user_roles' then
    if old.role_code = 'super_admin' and (tg_op = 'DELETE' or new.role_code <> 'super_admin') then
      select exists (select 1 from crm.user_roles ur join crm.profiles p on p.id = ur.user_id
                     where ur.role_code = 'super_admin' and p.is_active and ur.user_id <> old.user_id) into v_other;
      if not v_other then raise exception 'Son aktif Super Admin kaldırılamaz'; end if;
    end if;
  elsif tg_table_name = 'profiles' then
    if old.is_active and not new.is_active
       and exists (select 1 from crm.user_roles where user_id = old.id and role_code = 'super_admin') then
      select exists (select 1 from crm.user_roles ur join crm.profiles p on p.id = ur.user_id
                     where ur.role_code = 'super_admin' and p.is_active and ur.user_id <> old.id) into v_other;
      if not v_other then raise exception 'Son aktif Super Admin pasifleştirilemez'; end if;
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger guard_super_admin_roles before update or delete on crm.user_roles
  for each row execute function crm.guard_last_super_admin();
create trigger guard_super_admin_profiles before update on crm.profiles
  for each row execute function crm.guard_last_super_admin();
