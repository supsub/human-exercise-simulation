-- Uprawnienia do tabeli tylko dla zalogowanych (nowe projekty Supabase nie nadają ich automatycznie).
-- Które wiersze – decydują reguły RLS z poprzedniej migracji. Niezalogowani (anon) nie mają dostępu.
grant select, insert, update, delete on table public.user_data to authenticated;
revoke all on table public.user_data from anon;
