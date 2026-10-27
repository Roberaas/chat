alter table crm.profiles add column if not exists sms_extra_phones text[] not null default '{}';
