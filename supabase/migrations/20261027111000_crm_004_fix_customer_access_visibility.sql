-- INSERT ... RETURNING: STABLE fonksiyon, aynı komutta eklenen satırı göremez. VOLATILE yapılır;
-- ayrıca mağaza kapsamlı roller için birincil mağaza (customers.store_id) doğrudan kabul edilir.
create or replace function crm.can_access_customer(p_customer uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select crm.is_super_admin() or exists (
    select 1 from crm.customers c
    where c.id = p_customer and crm.is_active_user() and (
      c.assigned_to = auth.uid()
      or (crm.my_scope() = 'stores' and (
            c.store_id in (select crm.my_store_ids())
            or exists (select 1 from crm.customer_stores cs
                       where cs.customer_id = c.id and cs.store_id in (select crm.my_store_ids()))))
      or exists (select 1 from crm.customer_assignments a
                 where a.customer_id = c.id and a.advisor_id = auth.uid() and a.ended_at is null)))
$$;
