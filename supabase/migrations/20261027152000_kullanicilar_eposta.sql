alter table public.kullanicilar add column if not exists eposta text;
create unique index if not exists kullanicilar_eposta_uq on public.kullanicilar (lower(eposta));
update public.kullanicilar set eposta='kerem@robertobravo.com' where kullanici_adi='kerem';
