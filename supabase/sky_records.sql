-- 점프맵 방명록 + 기록 테이블 (Supabase SQL Editor에서 실행)

create table public.sky_records (
  id bigint generated always as identity primary key,
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
