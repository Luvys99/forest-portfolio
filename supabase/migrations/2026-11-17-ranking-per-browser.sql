-- #59 순위표에 브라우저마다 최고 기록 하나만 (이미 sky_records 를 만든 DB에 한 번 실행)

begin;

alter table public.sky_records add column player_id uuid;

-- 예전 기록에는 브라우저 id가 없으니 이름이 같으면 같은 사람으로 본다
with people as materialized (
  select name, gen_random_uuid() as player_id
  from public.sky_records
  group by name
)
update public.sky_records r
set player_id = p.player_id
from people p
where r.name = p.name;

alter table public.sky_records alter column player_id set not null;

revoke select on public.sky_records from anon;
grant select (id, name, message, time_ms, created_at) on public.sky_records to anon;

create view public.sky_ranking as
  select distinct on (player_id) id, name, message, time_ms, created_at
  from public.sky_records
  order by player_id, time_ms, created_at;

grant select on public.sky_ranking to anon;

commit;
