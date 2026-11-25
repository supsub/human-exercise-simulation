-- Ochrona przed starymi wersjami aplikacji (np. karta przeglądarki otwarta od dawna):
-- dane mają numer formatu `v`; zapis z niższym numerem niż obecny w bazie jest odrzucany,
-- więc stara aplikacja nie nadpisze danych zapisanych przez nowszą (pola, których nie zna, by przepadły).
-- Aplikacja po tym błędzie odświeża się do aktualnej wersji (src/sync.js).
create or replace function public.user_data_format_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce((new.data ->> 'v')::int, 0) < coalesce((old.data ->> 'v')::int, 0) then
    raise exception 'outdated_client: format % < %', coalesce((new.data ->> 'v')::int, 0), (old.data ->> 'v')::int
      using errcode = 'P0001', hint = 'Odśwież aplikację – na koncie są dane z nowszej wersji.';
  end if;
  return new;
end $$;
create trigger user_data_format_guard before update on public.user_data for each row execute function public.user_data_format_guard();
