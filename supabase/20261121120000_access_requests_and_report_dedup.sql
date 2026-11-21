-- Solicitudes de acceso administradas por el equipo de Trueke PRG.
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 2 and 60),
  phone text not null check (phone ~ '^2964[0-9]{6}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  processed_user_id uuid references auth.users(id) on delete set null
);

create unique index if not exists access_requests_one_pending_per_phone
  on public.access_requests(phone) where status = 'pending';
create index if not exists access_requests_status_created_idx
  on public.access_requests(status, created_at desc);

alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;
grant insert on public.access_requests to anon, authenticated;
grant select, update on public.access_requests to authenticated;

drop policy if exists "public can request access" on public.access_requests;
create policy "public can request access"
  on public.access_requests for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and processed_user_id is null
    and char_length(trim(display_name)) between 2 and 60
    and phone ~ '^2964[0-9]{6}$'
  );

drop policy if exists "admins read access requests" on public.access_requests;
create policy "admins read access requests"
  on public.access_requests for select to authenticated
  using (private.is_admin());

drop policy if exists "admins update access requests" on public.access_requests;
create policy "admins update access requests"
  on public.access_requests for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Una sola denuncia por persona y publicación, incluso si ya fue revisada.
create unique index if not exists reports_one_per_user_per_listing
  on public.reports(reporter_id, listing_id)
  where listing_id is not null;
