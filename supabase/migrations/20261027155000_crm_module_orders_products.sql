insert into crm.module_settings (module, enabled) values ('orders', false), ('products', false) on conflict do nothing;
