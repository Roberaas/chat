create index if not exists customer_product_interests_created_by_idx on crm.customer_product_interests(created_by);
create index if not exists job_executions_rule_id_idx on crm.job_executions(rule_id);
create index if not exists opportunities_stage_idx on crm.opportunities(stage);
drop index if exists public.idx_wa_sessions_roberto_phone;
