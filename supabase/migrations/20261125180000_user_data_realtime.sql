-- Zmiany planów na żywo między urządzeniami: baza powiadamia zalogowane przeglądarki o zmianie ich wiersza
-- (Supabase Realtime; reguły RLS obowiązują także tutaj – każdy dostaje tylko swoje zmiany).
alter publication supabase_realtime add table public.user_data;
