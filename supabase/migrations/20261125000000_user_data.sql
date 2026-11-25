-- Dane aplikacji użytkownika: cały stan planów (plany + treningi) jako jeden dokument JSON.
-- Każdy widzi i zmienia tylko swój wiersz (Row Level Security).
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "własne dane – odczyt" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "własne dane – dodanie" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "własne dane – zmiana" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "własne dane – usunięcie" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

-- znacznik czasu ustawia serwer (porównanie wersji między urządzeniami nie zależy od zegara telefonu)
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger user_data_touch before insert or update on public.user_data for each row execute function public.touch_updated_at();
