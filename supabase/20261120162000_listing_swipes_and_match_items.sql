-- Trueke PRG: persist the latest swipe decision and attach matched listings to each match.
create table if not exists public.listing_swipes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('like','dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

alter table public.listing_swipes enable row level security;
revoke all on public.listing_swipes from public, anon, authenticated;
grant select on public.listing_swipes to authenticated;
drop policy if exists "members read own listing swipes" on public.listing_swipes;
create policy "members read own listing swipes"
on public.listing_swipes for select to authenticated
using (user_id = (select auth.uid()));

alter table public.matches
  add column if not exists listing_one_id uuid references public.listings(id) on delete set null,
  add column if not exists listing_two_id uuid references public.listings(id) on delete set null;

create or replace function public.record_listing_swipe(p_listing_id uuid, p_decision text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_reciprocal_listing uuid;
  v_match_id uuid;
  v_one uuid;
  v_two uuid;
  v_listing_one uuid;
  v_listing_two uuid;
begin
  if v_user is null or not private.is_active_member() then
    raise exception 'Cuenta no habilitada';
  end if;
  if p_decision not in ('like','dislike') then
    raise exception 'Decisión inválida';
  end if;

  select l.user_id into v_owner
  from public.listings l
  where l.id = p_listing_id and l.status = 'published';

  if v_owner is null then
    raise exception 'La publicación ya no está disponible';
  end if;
  if v_owner = v_user then
    raise exception 'No podés votar tu propia publicación';
  end if;

  insert into public.listing_swipes(listing_id,user_id,decision)
  values (p_listing_id,v_user,p_decision)
  on conflict (listing_id,user_id)
  do update set decision = excluded.decision, updated_at = now();

  if p_decision = 'like' then
    insert into public.listing_interests(listing_id,user_id)
    values (p_listing_id,v_user)
    on conflict (listing_id,user_id) do nothing;

    select sw.listing_id into v_reciprocal_listing
    from public.listing_swipes sw
    join public.listings l on l.id = sw.listing_id
    where sw.user_id = v_owner
      and sw.decision = 'like'
      and l.user_id = v_user
      and l.status = 'published'
    order by sw.updated_at desc
    limit 1;

    if v_reciprocal_listing is not null then
      v_one := least(v_user,v_owner);
      v_two := greatest(v_user,v_owner);
      if v_user = v_one then
        v_listing_one := v_reciprocal_listing;
        v_listing_two := p_listing_id;
      else
        v_listing_one := p_listing_id;
        v_listing_two := v_reciprocal_listing;
      end if;

      insert into public.matches(user_one,user_two,listing_one_id,listing_two_id)
      values (v_one,v_two,v_listing_one,v_listing_two)
      on conflict (user_one,user_two)
      do update set listing_one_id = excluded.listing_one_id,
                    listing_two_id = excluded.listing_two_id,
                    created_at = now()
      returning id into v_match_id;
    end if;
  else
    delete from public.listing_interests
    where listing_id = p_listing_id and user_id = v_user;

    select sw.listing_id into v_reciprocal_listing
    from public.listing_swipes sw
    join public.listings l on l.id = sw.listing_id
    where sw.user_id = v_owner
      and sw.decision = 'like'
      and l.user_id = v_user
    order by sw.updated_at desc
    limit 1;

    if v_reciprocal_listing is not null then
      v_one := least(v_user,v_owner);
      v_two := greatest(v_user,v_owner);
      if v_user = v_one then
        v_listing_one := v_reciprocal_listing;
        v_listing_two := p_listing_id;
      else
        v_listing_one := p_listing_id;
        v_listing_two := v_reciprocal_listing;
      end if;
      delete from public.matches
      where user_one = v_one and user_two = v_two
        and listing_one_id = v_listing_one and listing_two_id = v_listing_two;
    end if;
  end if;

  return v_match_id;
end;
$$;

revoke all on function public.record_listing_swipe(uuid,text) from public, anon;
grant execute on function public.record_listing_swipe(uuid,text) to authenticated;
