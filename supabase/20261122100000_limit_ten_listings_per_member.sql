-- Trueke PRG: cada miembro puede mantener hasta diez publicaciones.
create or replace function private.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select count(*)::integer
    into v_total
  from public.listings
  where user_id = new.user_id;

  if v_total >= 10 then
    raise exception 'Ya alcanzaste el máximo de 10 publicaciones. Borrá una para publicar otra.';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_four_per_user on public.listings;
drop trigger if exists listings_enforce_ten_per_user on public.listings;
create trigger listings_enforce_ten_per_user
before insert on public.listings
for each row
execute function private.enforce_listing_limit();
