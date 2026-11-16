create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

create table if not exists public.authorized_phones (
  phone text primary key,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'pending' check (status in ('pending','active','blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  description text not null,
  offer text not null,
  looking_for text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, from_user)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  post_one uuid references public.posts(id) on delete set null,
  post_two uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_one <> user_two),
  unique(user_one, user_two)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.direct_proposals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
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
  post_id uuid references public.posts(id) on delete set null,
  reported_user uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at timestamptz not null default now()
);

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.current_user_is_active()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

create or replace function public.validate_registration(p_phone text, p_invite_code text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.authorized_phones a where a.phone = p_phone)
     and exists(select 1 from public.app_settings s where s.key = 'invite_code' and s.value = to_jsonb(p_invite_code));
$$;

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.current_user_is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.phone := old.phone;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger before update on public.profiles
for each row execute procedure public.protect_profile_fields();

create or replace function public.accept_direct_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  proposal public.direct_proposals;
  a uuid;
  b uuid;
  created_match uuid;
begin
  select * into proposal from public.direct_proposals where id = p_proposal_id for update;
  if not public.current_user_is_active() then
    raise exception 'Cuenta no habilitada';
  end if;
  if proposal.id is null or proposal.recipient_id <> auth.uid() or proposal.status <> 'pending' then
    raise exception 'Propuesta no disponible';
  end if;
  update public.direct_proposals set status = 'accepted' where id = p_proposal_id;
  a := least(proposal.sender_id, proposal.recipient_id);
  b := greatest(proposal.sender_id, proposal.recipient_id);
  insert into public.matches(user_one,user_two,post_one)
  values (a,b,proposal.post_id)
  on conflict (user_one,user_two) do update set created_at = now()
  returning id into created_match;
  return created_match;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, phone, display_name, status)
  values (new.id, coalesce(new.phone, ''), coalesce(new.raw_user_meta_data->>'display_name',''), 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_trueke on auth.users;
create trigger on_auth_user_created_trueke
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_mutual_match()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  target_owner uuid;
  reciprocal_post uuid;
  a uuid;
  b uuid;
begin
  select user_id into target_owner from public.posts where id = new.post_id;
  if target_owner is null or target_owner = new.from_user then return new; end if;

  select i.post_id into reciprocal_post
  from public.interests i
  join public.posts p on p.id = i.post_id
  where i.from_user = target_owner and p.user_id = new.from_user
  order by i.created_at desc limit 1;

  if reciprocal_post is not null then
    a := least(target_owner, new.from_user);
    b := greatest(target_owner, new.from_user);
    insert into public.matches(user_one, user_two, post_one, post_two)
    values (a, b, new.post_id, reciprocal_post)
    on conflict (user_one, user_two) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_interest_create_match on public.interests;
create trigger on_interest_create_match after insert on public.interests
for each row execute procedure public.create_mutual_match();

alter table public.app_settings enable row level security;
alter table public.authorized_phones enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.interests enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.direct_proposals enable row level security;

drop policy if exists "admins manage settings" on public.app_settings;
create policy "admins manage settings" on public.app_settings for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "admins manage authorized phones" on public.authorized_phones;
create policy "admins manage authorized phones" on public.authorized_phones for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "read active profiles" on public.profiles;
create policy "read active profiles" on public.profiles for select using (status = 'active' or id = auth.uid() or public.current_user_is_admin());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid() or public.current_user_is_admin()) with check (id = auth.uid() or public.current_user_is_admin());
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "active members read posts" on public.posts;
create policy "active members read posts" on public.posts for select using (public.current_user_is_active() and active);
drop policy if exists "owners create posts" on public.posts;
create policy "owners create posts" on public.posts for insert with check (user_id = auth.uid() and public.current_user_is_active());
drop policy if exists "owners update posts" on public.posts;
create policy "owners update posts" on public.posts for update using (user_id = auth.uid() or public.current_user_is_admin()) with check (user_id = auth.uid() or public.current_user_is_admin());
drop policy if exists "owners or admins delete posts" on public.posts;
create policy "owners or admins delete posts" on public.posts for delete using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "members read interests" on public.interests;
create policy "members read interests" on public.interests for select using (from_user = auth.uid() or exists(select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()) or public.current_user_is_admin());
drop policy if exists "active members send interest" on public.interests;
create policy "active members send interest" on public.interests for insert with check (from_user = auth.uid() and public.current_user_is_active());

drop policy if exists "match participants read" on public.matches;
create policy "match participants read" on public.matches for select using (auth.uid() in (user_one,user_two) or public.current_user_is_admin());
drop policy if exists "match participants messages read" on public.messages;
create policy "match participants messages read" on public.messages for select using (exists(select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_one,m.user_two)) or public.current_user_is_admin());
drop policy if exists "match participants send messages" on public.messages;
create policy "match participants send messages" on public.messages for insert with check (sender_id = auth.uid() and exists(select 1 from public.matches m where m.id = match_id and auth.uid() in (m.user_one,m.user_two)) and public.current_user_is_active());

drop policy if exists "proposal participants read" on public.direct_proposals;
create policy "proposal participants read" on public.direct_proposals for select using (sender_id = auth.uid() or recipient_id = auth.uid() or public.current_user_is_admin());
drop policy if exists "active users send proposals" on public.direct_proposals;
create policy "active users send proposals" on public.direct_proposals for insert with check (sender_id = auth.uid() and public.current_user_is_active() and recipient_id <> auth.uid() and exists(select 1 from public.posts p where p.id = post_id and p.user_id = recipient_id and p.active = true));
drop policy if exists "recipient updates proposals" on public.direct_proposals;

grant execute on function public.validate_registration(text,text) to anon, authenticated;
grant execute on function public.accept_direct_proposal(uuid) to authenticated;

drop policy if exists "users create reports" on public.reports;
create policy "users create reports" on public.reports for insert with check (reporter_id = auth.uid() and public.current_user_is_active());
drop policy if exists "reporter and admins read reports" on public.reports;
create policy "reporter and admins read reports" on public.reports for select using (reporter_id = auth.uid() or public.current_user_is_admin());
drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trueke-photos', 'trueke-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "active users upload trueke photos" on storage.objects;
create policy "active users upload trueke photos" on storage.objects for insert to authenticated with check (bucket_id = 'trueke-photos' and public.current_user_is_active());
drop policy if exists "public reads trueke photos" on storage.objects;
create policy "public reads trueke photos" on storage.objects for select using (bucket_id = 'trueke-photos');
drop policy if exists "owners delete trueke photos" on storage.objects;
create policy "owners delete trueke photos" on storage.objects for delete to authenticated using (bucket_id = 'trueke-photos' and owner = auth.uid());

-- Para cambiar el código general desde SQL:
-- update public.app_settings set value = '"NUEVO-CODIGO"'::jsonb where key = 'invite_code';
