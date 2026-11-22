-- Trueke PRG: moderation and self-service editing of public display names.

create table if not exists private.blocked_display_name_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  normalized_term text not null unique,
  created_at timestamptz not null default now(),
  constraint blocked_display_name_terms_term_length check (char_length(btrim(term)) between 2 and 40)
);

revoke all on private.blocked_display_name_terms from public, anon, authenticated;

create or replace function private.normalize_display_name(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := lower(translate(coalesce(p_value, ''), 'áéíóúüñ', 'aeiouun'));
  v := translate(v, '0123456789@$!', 'oizeasgtbgasi');
  v := regexp_replace(v, '[^a-z0-9[:space:]]+', '', 'g');
  v := regexp_replace(btrim(v), '[[:space:]]+', ' ', 'g');
  return v;
end;
$$;

insert into private.blocked_display_name_terms (term, normalized_term)
select term, private.normalize_display_name(term)
from (values
  ('pelotudo'), ('pelotuda'), ('forro'), ('forra'),
  ('idiota'), ('imbecil'), ('estupido'), ('estupida'),
  ('mierda'), ('malparido'), ('malparida'),
  ('puto'), ('puta'), ('putita'), ('putito'),
  ('maricon'), ('trolo'), ('trola'),
  ('mogolico'), ('mogolica'), ('retrasado'), ('retrasada'),
  ('conchudo'), ('conchuda'), ('hijodeputa'),
  ('hdp'), ('culo roto'), ('negro de mierda'),
  ('judío de mierda'), ('judia de mierda'),
  ('matar'), ('violacion'), ('violador'), ('violadora')
) as seed(term)
on conflict (normalized_term) do nothing;

create or replace function public.enforce_profile_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized text;
  v_compact text;
  v_term record;
begin
  if tg_op = 'INSERT' or new.display_name is distinct from old.display_name then
    new.display_name := regexp_replace(btrim(coalesce(new.display_name, '')), '[[:space:]]+', ' ', 'g');

    if char_length(new.display_name) < 3 or char_length(new.display_name) > 25 then
      raise exception 'El nombre visible debe tener entre 3 y 25 caracteres.';
    end if;

    v_normalized := private.normalize_display_name(new.display_name);
    v_compact := replace(v_normalized, ' ', '');

    for v_term in
      select normalized_term
      from private.blocked_display_name_terms
    loop
      if position(' ' || v_term.normalized_term || ' ' in ' ' || v_normalized || ' ') > 0
         or (v_normalized ~ '^[a-z0-9]( [a-z0-9]){2,}$' and v_compact = v_term.normalized_term) then
        raise exception 'Ese nombre no está permitido. Elegí otro nombre visible.';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_display_name_before_update on public.profiles;
create trigger enforce_profile_display_name_before_update
before insert or update of display_name on public.profiles
for each row
execute function public.enforce_profile_display_name();

drop trigger if exists enforce_access_request_display_name on public.access_requests;
create trigger enforce_access_request_display_name
before insert or update of display_name on public.access_requests
for each row
execute function public.enforce_profile_display_name();

create or replace function public.admin_manage_display_name_terms(
  p_action text,
  p_term text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term text;
  v_normalized text;
begin
  if not private.is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_action = 'list' then
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'term', term) order by term)
      from private.blocked_display_name_terms
    ), '[]'::jsonb);
  elsif p_action = 'add' then
    v_term := regexp_replace(btrim(coalesce(p_term, '')), '[[:space:]]+', ' ', 'g');
    if char_length(v_term) < 2 or char_length(v_term) > 40 then
      raise exception 'La palabra o expresión debe tener entre 2 y 40 caracteres.';
    end if;
    v_normalized := private.normalize_display_name(v_term);
    if char_length(replace(v_normalized, ' ', '')) < 2 then
      raise exception 'Ingresá una palabra válida.';
    end if;
    insert into private.blocked_display_name_terms(term, normalized_term)
    values (v_term, v_normalized)
    on conflict (normalized_term) do nothing;
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'term', term) order by term)
      from private.blocked_display_name_terms
    ), '[]'::jsonb);
  elsif p_action = 'remove' then
    v_normalized := private.normalize_display_name(coalesce(p_term, ''));
    delete from private.blocked_display_name_terms
    where normalized_term = v_normalized;
    return coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'term', term) order by term)
      from private.blocked_display_name_terms
    ), '[]'::jsonb);
  else
    raise exception 'Acción no permitida';
  end if;
end;
$$;

revoke all on function public.admin_manage_display_name_terms(text, text) from public, anon;
grant execute on function public.admin_manage_display_name_terms(text, text) to authenticated;
