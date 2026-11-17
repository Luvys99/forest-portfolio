-- 점프맵 클리어 기록 테이블과 순위 뷰 (Supabase SQL Editor에서 실행). 방명록은 guestbook.sql
-- 이미 만든 DB에는 supabase/migrations/ 의 파일을 날짜 순서로 실행한다

create table public.sky_records (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 12),
  time_ms integer not null check (time_ms between 15000 and 3600000),
  created_at timestamptz not null default now()
);

-- RLS: 누구나 읽기와 쓰기만 가능하고, 수정과 삭제는 막는다
alter table public.sky_records enable row level security;

create policy "누구나 읽기" on public.sky_records
  for select to anon using (true);

create policy "누구나 쓰기" on public.sky_records
  for insert to anon with check (true);

-- 순위표: 이름마다 가장 빠른 기록 하나 (같으면 먼저 세운 기록). 로그인이 없으므로 같은 이름 = 같은 사람
-- 읽는 사람(anon) 권한과 RLS 로 읽는다
create view public.sky_ranking with (security_invoker = true) as
  select distinct on (name) id, name, time_ms, created_at
  from public.sky_records
  order by name, time_ms, created_at;

grant select on public.sky_ranking to anon;
