-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- It creates the watchlist table, locks it so each person can only see and change their OWN rows,
-- caps it at 50 stocks, and adds the function behind "Delete my account".

create table if not exists public.watchlist (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol     text not null check (symbol ~ '^[A-Z0-9&_.-]{1,25}$'),
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

alter table public.watchlist enable row level security;

create policy "read own watchlist"   on public.watchlist for select using (auth.uid() = user_id);
create policy "add to own watchlist" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "remove from own"      on public.watchlist for delete using (auth.uid() = user_id);

-- Server-side cap: a person can keep at most 50 stocks (the website also checks, but this cannot be bypassed).
create or replace function public.enforce_watchlist_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.watchlist where user_id = new.user_id) >= 50 then
    raise exception 'Watchlist is full (50 stocks)';
  end if;
  return new;
end $$;

drop trigger if exists watchlist_limit on public.watchlist;
create trigger watchlist_limit before insert on public.watchlist
  for each row execute function public.enforce_watchlist_limit();

-- "Delete my account" on the Account page. Deleting the login also deletes the watchlist rows (on delete cascade).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
