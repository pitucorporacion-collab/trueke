-- Preserve all likes made before swipe decisions became persistent.
insert into public.listing_swipes(listing_id,user_id,decision,created_at,updated_at)
select listing_id,user_id,'like',created_at,created_at
from public.listing_interests
on conflict (listing_id,user_id) do nothing;

-- Attach one reciprocal pair of listings to existing member matches where possible.
with reciprocal_pairs as (
  select m.id,
         i_one.listing_id as listing_one_id,
         i_two.listing_id as listing_two_id,
         row_number() over (
           partition by m.id
           order by greatest(i_one.created_at,i_two.created_at) desc
         ) as position
  from public.matches m
  join public.listings l_one on l_one.user_id=m.user_one and l_one.status='published'
  join public.listing_interests i_one on i_one.listing_id=l_one.id and i_one.user_id=m.user_two
  join public.listings l_two on l_two.user_id=m.user_two and l_two.status='published'
  join public.listing_interests i_two on i_two.listing_id=l_two.id and i_two.user_id=m.user_one
)
update public.matches m
set listing_one_id=p.listing_one_id, listing_two_id=p.listing_two_id
from reciprocal_pairs p
where p.id=m.id and p.position=1
  and m.listing_one_id is null and m.listing_two_id is null;
