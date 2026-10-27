insert into crm.role_permissions (role_code, permission_code) values
  ('store_manager','reports.export'),('dealer_admin','reports.export'),('b2b_manager','reports.export'),('b2b_manager','customers.export')
on conflict do nothing;
