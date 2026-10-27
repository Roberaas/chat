-- Panel: müşteri notları ve etiketleri (eksikti). Yalnızca sunucu (servis anahtarı) erişir; RLS açık, politika yok.
create table if not exists public.musteri_notlari (
  id bigint generated always as identity primary key,
  telefon text not null,
  icerik text not null check (length(icerik) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists musteri_notlari_tel_idx on public.musteri_notlari (telefon, created_at desc);
create table if not exists public.musteri_etiketler (
  id bigint generated always as identity primary key,
  telefon text not null,
  etiket text not null check (length(etiket) between 1 and 40),
  renk text not null default '#7c9059',
  created_at timestamptz not null default now(),
  unique (telefon, etiket)
);
alter table public.musteri_notlari enable row level security;
alter table public.musteri_etiketler enable row level security;
revoke all on public.musteri_notlari, public.musteri_etiketler from anon, authenticated;
