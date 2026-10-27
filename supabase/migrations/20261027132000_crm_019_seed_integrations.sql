insert into crm.integrations (code, kind, name, secret_env)
values ('pusula','erp','Pusula (ERP)','CRM_WEBHOOK_SECRET_PUSULA'),
       ('crealive','ecommerce','Crealive (e-ticaret)','CRM_WEBHOOK_SECRET_CREALIVE')
on conflict (code) do nothing;
