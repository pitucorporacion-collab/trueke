alter table public.reports add column if not exists listing_title text not null default '';
update public.reports r
set listing_title = l.title
from public.listings l
where r.listing_id = l.id and coalesce(r.listing_title,'') = '';
