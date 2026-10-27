-- INSERT...RETURNING: fonksiyon içi tablo sorgusu yeni satırı görmez; satır sütunlarıyla doğrudan kontrol eklendi.
drop policy cust_select on crm.customers;
create policy cust_select on crm.customers for select to authenticated
  using ((select crm.has_perm('customers.read')) and (
    assigned_to = (select auth.uid())
    or (select crm.is_super_admin())
    or ((select crm.my_scope()) = 'stores' and store_id in (select crm.my_store_ids()))
    or crm.can_access_customer(id)));
