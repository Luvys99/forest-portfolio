// 방명록 (Supabase guestbook 테이블). 클리어와 상관없이 누구나 이름과 한마디를 남긴다 (#62)

import { insertRow, request, WriteCooldown } from './supabase';

// 방문자 글의 길이 제한. 같은 규칙이 supabase/*.sql 의 check 제약과 중계 서버(Validation.java)에도 있다
export const NAME_MAX = 12;
export const MESSAGE_MAX = 60;

const cooldown = new WriteCooldown('forest-portfolio:guestbook-last-write', 60_000);

export interface GuestbookEntry
{
    id: number;
    name: string;
    message: string;
    created_at: string;
}

const COLUMNS = 'id,name,message,created_at';

// 최근 글 순
export function fetchGuestbook (limit = 20)
{
    return request<GuestbookEntry[]>(`guestbook?select=${COLUMNS}&order=created_at.desc,id.desc&limit=${limit}`);
}

export async function addGuestbookEntry (name: string, message: string)
{
    cooldown.check();
    const entry = await insertRow<GuestbookEntry>('guestbook', COLUMNS, {
        name: name.trim().slice(0, NAME_MAX),
        message: message.trim().slice(0, MESSAGE_MAX)
    });
    cooldown.mark();
    return entry;
}
