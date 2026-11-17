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

export const GUESTBOOK_PAGE = 20;

// 최근 글 순으로 한 묶음. beforeId 를 주면 그 글보다 오래된 것부터 (id 는 쓴 순서대로 커진다).
// 몇 번째부터(offset)가 아니라 마지막으로 받은 글 기준이라, 보는 사이에 새 글이 올라와도 겹치거나 빠지지 않는다
export function fetchGuestbook (beforeId?: number, limit = GUESTBOOK_PAGE)
{
    const before = beforeId === undefined ? '' : `&id=lt.${beforeId}`;
    return request<GuestbookEntry[]>(`guestbook?select=${COLUMNS}${before}&order=id.desc&limit=${limit}`);
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
