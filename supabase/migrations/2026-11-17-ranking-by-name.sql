-- #69 순위표를 브라우저가 아니라 이름으로 묶는다 (#59 의 브라우저 id 를 걷어 낸다)

begin;

drop view public.sky_ranking;
alter table public.sky_records drop column player_id;

-- 숨길 칸이 없어졌으므로 칸 단위 권한을 테이블 단위로 되돌린다
revoke select on public.sky_records from anon;
grant select on public.sky_records to anon;

create view public.sky_ranking with (security_invoker = true) as
  select distinct on (name) id, name, time_ms, created_at
  from public.sky_records
  order by name, time_ms, created_at;

grant select on public.sky_ranking to anon;

commit;
