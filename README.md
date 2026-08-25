# Roberto Admin Panel

Roberto Bravo ve 935 by Roberto Bravo WhatsApp bot yönetim paneli.

## Özellikler

- **Genel Bakış** — Aktif konuşma, KVKK oranı, canlı destek kuyruğu, son 24 saat trafiği
- **Konuşmalar** — Tüm müşteri oturumları, filtreleme, detay drawer
- **Canlı Destek** — Aktif kuyruk, bekleme süresi, bot moduna alma butonu
- **Müşteriler** — Müşteri listesi ve geçmişi
- **Raporlar** — 14 günlük trafik, niyet dağılımı
- **Çalışma / Takvim** — Ekip görev takibi

## Stack

- Next.js 14 + TypeScript
- Supabase (ogfdikzqcacmbkrnvafo)
- OpenAI GPT-4o-mini (sesli asistan)
- Tailwind CSS

## Kurulum

```bash
npm install
cp .env.example .env.local
# .env.local doldurun
npm run dev
```

## Supabase Şeması

```sql
-- WhatsApp bot oturumları
wa_sessions_roberto (phone, musteri_yazdigi, gecmis, son_mesaj_id, kvkk_onay, saatlik_sayac, sayac_baslangic, created_at, updated_at)

-- Admin kullanıcılar
kullanicilar (id, ad, kullanici_adi, sifre_hash, rol, aktif, son_giris, created_at)

-- Aktivite logu
aktivite_log (id, kullanici_adi, kullanici_ad, aksiyon, sayfa, detay, created_at)
```
# push test Mon Aug 24 15:06:38 UTC 2026
