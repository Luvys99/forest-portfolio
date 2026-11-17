-- 점프맵 방명록 + 기록 테이블 (Supabase SQL Editor에서 실행)
-- 이미 만든 DB에는 supabase/migrations/ 의 파일을 날짜 순서로 실행한다

create table public.sky_records (
  id bigint generated always as identity primary key,
  -- 브라우저마다 만든 무작위 id (client/src/lib/playerId.ts). 순위표에서 같은 사람을 묶는다
  player_id uuid not null,
  name text not null check (char_length(name) between 1 and 12),
  message text not null default '' check (char_length(message) <= 60),
  time_ms integer not null check (time_ms between 15000 and 3600000),
  created_at timestamptz not null default now()
);

-- RLS: 누구나 읽기와 쓰기만 가능하고, 수정과 삭제는 막는다
alter table public.sky_records enable row level security;

create policy "누구나 읽기" on public.sky_records
  for select to anon using (true);

create policy "누구나 쓰기" on public.sky_records
  for insert to anon with check (true);

-- 남의 브라우저 id를 알면 그 사람 이름으로 기록을 끼워 넣을 수 있으므로 읽지 못하게 한다
revoke select on public.sky_records from anon;
grant select (id, name, message, time_ms, created_at) on public.sky_records to anon;

-- 순위표: 브라우저마다 가장 빠른 기록 하나 (같으면 먼저 세운 기록)
-- 뷰는 만든 사람(postgres) 권한으로 읽으므로 anon 이 읽지 못하는 player_id 로도 묶을 수 있고, 밖으로는 내보내지 않는다
create view public.sky_ranking as
  select distinct on (player_id) id, name, message, time_ms, created_at
  from public.sky_records
  order by player_id, time_ms, created_at;

grant select on public.sky_ranking to anon;
