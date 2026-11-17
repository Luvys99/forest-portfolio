-- #62 방명록을 기록과 분리 (이미 sky_records 를 만든 DB에 한 번 실행)

begin;

create table public.guestbook (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 12),
  message text not null check (char_length(message) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.guestbook enable row level security;

create policy "누구나 읽기" on public.guestbook
  for select to anon using (true);

create policy "누구나 쓰기" on public.guestbook
  for insert to anon with check (true);

-- 기록에 붙여 남겼던 한마디를 방명록으로 옮긴다 (한마디 없이 기록만 남긴 줄은 옮기지 않는다)
insert into public.guestbook (name, message, created_at)
select name, message, created_at
from public.sky_records
where message <> ''
order by created_at;

-- 기록에서는 한마디 칸을 뺀다 (순위 뷰가 이 칸을 쓰고 있어서 뷰를 다시 만든다)
drop view public.sky_ranking;
alter table public.sky_records drop column message;

create view public.sky_ranking as
  select distinct on (player_id) id, name, time_ms, created_at
  from public.sky_records
  order by player_id, time_ms, created_at;

grant select on public.sky_ranking to anon;

commit;
