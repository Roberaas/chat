-- Hazır otomasyon kuralları (yönetici Otomasyonlar sayfasından düzenleyebilir/kapatabilir)
insert into crm.automation_rules (name, event_type, conditions, action_type, action_config, is_active)
select v.name, v.event_type, v.conditions::jsonb, v.action_type, v.action_config::jsonb, true
from (values
  ('Yeni müşteri: karşılama araması', 'customer_created', '{}', 'create_task', '{"title":"Yeni müşteriyi ara: {{musteri}}","assignee":"customer_advisor","due_in_hours":24}'),
  ('Satış kazanıldı: teşekkür ve memnuniyet görevi', 'opportunity_stage_changed', '{"stage":"won"}', 'create_task', '{"title":"Teşekkür mesajı gönder: {{musteri}}","assignee":"opportunity_owner","due_in_hours":48}'),
  ('Satış kaybedildi: geri kazanım görevi', 'opportunity_stage_changed', '{"stage":"lost"}', 'create_task', '{"title":"Kayıp nedenini sor ve yeniden dene: {{musteri}}","assignee":"opportunity_owner","due_in_hours":168}'),
  ('Randevuya gelmedi: takip', 'appointment_status_changed', '{"status":"no_show"}', 'create_task', '{"title":"Gelmeyen müşteriyi ara: {{musteri}}","assignee":"customer_advisor","due_in_hours":24}'),
  ('Yüksek öncelikli servis talebi: bildirim', 'service_created', '{"priority":"high"}', 'notify_owner', '{"title":"Yüksek öncelikli servis talebi: {{musteri}}","assignee":"customer_advisor"}'),
  ('Yeni sipariş: teşekkür görevi', 'order_created', '{}', 'create_task', '{"title":"Sipariş sonrası teşekkür: {{musteri}}","assignee":"customer_advisor","due_in_hours":24}')
) as v(name, event_type, conditions, action_type, action_config)
where not exists (select 1 from crm.automation_rules r where r.name = v.name);
