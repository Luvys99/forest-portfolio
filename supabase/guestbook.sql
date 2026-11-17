-- 방명록 테이블 (Supabase SQL Editor에서 실행). 클리어 기록(sky_records)과 따로, 누구나 이름과 한마디를 남긴다
-- 이미 만든 DB에는 supabase/migrations/ 의 파일을 날짜 순서로 실행한다

create table public.guestbook (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 12),
  message text not null check (char_length(message) between 1 and 60),
  created_at timestamptz not null default now()
);

-- RLS: 누구나 읽기와 쓰기만 가능하고, 수정과 삭제는 막는다
alter table public.guestbook enable row level security;

create policy "누구나 읽기" on public.guestbook
  for select to anon using (true);

create policy "누구나 쓰기" on public.guestbook
  for insert to anon with check (true);
