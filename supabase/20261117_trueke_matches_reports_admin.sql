-- Trueke PRG: matches, proposals, reports, admin notifications and moderation.
update public.profiles
set role = 'admin', is_active = true
where regexp_replace(phone, '[^0-9]', '', 'g') = '5492964489718';

create table if not exists public.listing_interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(listing_id, user_id)
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_one < user_two),
  unique(user_one, user_two)
);
create table if not exists public.direct_proposals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1500),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  reported_user uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 2 and 120),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.reports(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.create_listing_mutual_match()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid;
begin
  select l.user_id into owner_id from public.listings l where l.id = new.listing_id and l.status = 'published';
  if owner_id is null or owner_id = new.user_id then return new; end if;
  if exists (
    select 1 from public.listing_interests i
    join public.listings l on l.id = i.listing_id
    where i.user_id = owner_id and l.user_id = new.user_id and l.status = 'published'
  ) then
    insert into public.matches(user_one,user_two)
    values (least(owner_id,new.user_id), greatest(owner_id,new.user_id))
    on conflict (user_one,user_two) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists listing_interest_mutual_match on public.listing_interests;
create trigger listing_interest_mutual_match after insert on public.listing_interests
for each row execute function public.create_listing_mutual_match();

create or replace function public.create_admin_report_notification()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.admin_notifications(admin_id,report_id,title,body)
  select p.id, new.id, 'Nueva denuncia en Trueke PRG',
    'Motivo: ' || new.reason || case when new.details <> '' then ' — ' || new.details else '' end
  from public.profiles p
  where p.role = 'admin' and p.is_active = true;
  return new;
end;
$$;
drop trigger if exists report_admin_notification on public.reports;
create trigger report_admin_notification after insert on public.reports
for each row execute function public.create_admin_report_notification();

create or replace function public.accept_trueke_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare proposal public.direct_proposals; v_match_id uuid;
begin
  if not private.is_active_member() then raise exception 'Cuenta no habilitada'; end if;
  select * into proposal from public.direct_proposals where id = p_proposal_id for update;
  if proposal.id is null or proposal.recipient_id <> auth.uid() or proposal.status <> 'pending' then
    raise exception 'Propuesta no disponible';
  end if;
  update public.direct_proposals set status='accepted' where id=p_proposal_id;
  insert into public.matches(user_one,user_two)
  values (least(proposal.sender_id,proposal.recipient_id), greatest(proposal.sender_id,proposal.recipient_id))
  on conflict (user_one,user_two) do update set created_at=now()
  returning id into v_match_id;
  return v_match_id;
end;
$$;

alter table public.listing_interests enable row level security;
alter table public.matches enable row level security;
alter table public.direct_proposals enable row level security;
alter table public.reports enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists "active members create interests" on public.listing_interests;
create policy "active members create interests" on public.listing_interests
for insert to authenticated with check (user_id=auth.uid() and private.is_active_member()
  and exists(select 1 from public.listings l where l.id=listing_id and l.user_id<>auth.uid() and l.status='published'));
drop policy if exists "members read own interests and listing owners read incoming" on public.listing_interests;
create policy "members read own interests and listing owners read incoming" on public.listing_interests
for select to authenticated using (user_id=auth.uid()
  or exists(select 1 from public.listings l where l.id=listing_id and l.user_id=auth.uid())
  or private.is_admin());

drop policy if exists "match participants read matches" on public.matches;
create policy "match participants read matches" on public.matches
for select to authenticated using (auth.uid() in (user_one,user_two) or private.is_admin());

drop policy if exists "active members create direct proposals" on public.direct_proposals;
create policy "active members create direct proposals" on public.direct_proposals
for insert to authenticated with check (sender_id=auth.uid() and private.is_active_member()
  and recipient_id<>auth.uid()
  and exists(select 1 from public.listings l where l.id=listing_id and l.user_id=recipient_id and l.status='published'));
drop policy if exists "proposal participants read proposals" on public.direct_proposals;
create policy "proposal participants read proposals" on public.direct_proposals
for select to authenticated using (auth.uid() in (sender_id,recipient_id) or private.is_admin());
drop policy if exists "recipients update proposals" on public.direct_proposals;
create policy "recipients update proposals" on public.direct_proposals
for update to authenticated using (recipient_id=auth.uid() or private.is_admin())
with check (recipient_id=auth.uid() or private.is_admin());

drop policy if exists "active members submit reports" on public.reports;
create policy "active members submit reports" on public.reports
for insert to authenticated with check (reporter_id=auth.uid() and private.is_active_member()
  and (listing_id is not null or reported_user is not null));
drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports
for select to authenticated using (private.is_admin());
drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports
for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists "admins read notifications" on public.admin_notifications;
create policy "admins read notifications" on public.admin_notifications
for select to authenticated using (admin_id=auth.uid() and private.is_admin());
drop policy if exists "admins update notifications" on public.admin_notifications;
create policy "admins update notifications" on public.admin_notifications
for update to authenticated using (admin_id=auth.uid() and private.is_admin())
with check (admin_id=auth.uid() and private.is_admin());

grant select, insert on public.listing_interests to authenticated;
grant select on public.matches to authenticated;
grant select, insert, update on public.direct_proposals to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, update on public.admin_notifications to authenticated;

revoke select on public.profiles from authenticated;
grant select (id, display_name, avatar_path, role, is_active, created_at) on public.profiles to authenticated;

create or replace function public.get_trueke_match_contacts()
returns table(match_id uuid, contact_user_id uuid, display_name text, phone text)
language sql stable security definer set search_path = ''
as $$
  select m.id, p.id, p.display_name, p.phone
  from public.matches m
  join public.profiles p on p.id = case when m.user_one = auth.uid() then m.user_two else m.user_one end
  where auth.uid() in (m.user_one,m.user_two)
    and private.is_active_member()
    and p.is_active = true;
$$;
grant execute on function public.get_trueke_match_contacts() to authenticated;

create or replace function public.admin_set_member_active(p_user_id uuid, p_active boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'No autorizado'; end if;
  if p_user_id = auth.uid() then raise exception 'No podés bloquear tu propia cuenta'; end if;
  update public.profiles set is_active=p_active where id=p_user_id;
  if not p_active then
    update public.listings set status='paused', updated_at=now() where user_id=p_user_id and status='published';
  end if;
  return found;
end;
$$;
grant execute on function public.admin_set_member_active(uuid,boolean) to authenticated;

create or replace function public.admin_get_members()
returns table(id uuid, display_name text, phone text, role text, is_active boolean, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id,p.display_name,p.phone,p.role,p.is_active,p.created_at
  from public.profiles p
  where private.is_admin()
  order by p.created_at desc;
$$;
grant execute on function public.admin_get_members() to authenticated;

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles
for update to authenticated using (private.is_admin()) with check (private.is_admin());

revoke all on function public.get_trueke_match_contacts() from public, anon;
revoke all on function public.admin_get_members() from public, anon;
revoke all on function public.admin_set_member_active(uuid,boolean) from public, anon;
revoke all on function public.accept_trueke_proposal(uuid) from public, anon;
revoke all on function public.create_listing_mutual_match() from public, anon, authenticated;
revoke all on function public.create_admin_report_notification() from public, anon, authenticated;
grant execute on function public.get_trueke_match_contacts() to authenticated;
grant execute on function public.admin_get_members() to authenticated;
grant execute on function public.admin_set_member_active(uuid,boolean) to authenticated;
grant execute on function public.accept_trueke_proposal(uuid) to authenticated;
