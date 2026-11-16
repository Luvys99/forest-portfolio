// 점프맵 방명록 + 기록 (Supabase REST API)
// 서버를 직접 운영하지 않고, Supabase가 테이블마다 만들어 주는 REST API를 fetch로 부른다.
// 누가 무엇을 할 수 있는지는 DB의 RLS 정책이 정한다 (읽기 + 쓰기만, 수정·삭제 불가)

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const NAME_MAX = 12;
export const MESSAGE_MAX = 60;
// 연속 작성 막기 (브라우저 기준이라 완전한 방어는 아니다)
const WRITE_COOLDOWN_MS = 60_000;
const LAST_WRITE_KEY = 'forest-portfolio:guestbook-last-write';

export interface SkyRecord
{
    id: number;
    name: string;
    message: string;
    time_ms: number;
    created_at: string;
}

export const guestbookEnabled = Boolean(URL && KEY);

async function request<T> (path: string, init: RequestInit = {}): Promise<T>
{
    if (!URL || !KEY)
    {
        throw new Error('방명록 설정이 없습니다');
    }

    const response = await fetch(`${URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: KEY,
            'Content-Type': 'application/json',
            ...init.headers
        }
    });

    if (!response.ok)
    {
        throw new Error(`방명록 요청 실패 (${response.status})`);
    }

    return response.status === 204 ? (undefined as T) : response.json();
}

// 빠른 기록 순
export function fetchRanking (limit = 10)
{
    return request<SkyRecord[]>(`sky_records?select=*&order=time_ms.asc,created_at.asc&limit=${limit}`);
}

// 최근 방명록 순
export function fetchRecent (limit = 20)
{
    return request<SkyRecord[]>(`sky_records?select=*&order=created_at.desc&limit=${limit}`);
}

export async function addRecord (name: string, message: string, timeMs: number)
{
    const wait = cooldownLeft();
    if (wait > 0)
    {
        throw new Error(`${Math.ceil(wait / 1000)}초 뒤에 다시 남길 수 있어요`);
    }

    const [ record ] = await request<SkyRecord[]>('sky_records', {
        method: 'POST',
        // 저장된 행을 응답으로 돌려받는다 (내 기록을 순위표에서 강조하려고)
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
            name: name.trim().slice(0, NAME_MAX),
            message: message.trim().slice(0, MESSAGE_MAX),
            time_ms: Math.round(timeMs)
        })
    });

    try
    {
        localStorage.setItem(LAST_WRITE_KEY, String(Date.now()));
    }
    catch
    {
        // 저장소가 막혀 있으면 쿨다운 없이 넘어간다
    }

    return record;
}

function cooldownLeft ()
{
    try
    {
        const last = Number(localStorage.getItem(LAST_WRITE_KEY)) || 0;
        return Math.max(0, last + WRITE_COOLDOWN_MS - Date.now());
    }
    catch
    {
        return 0;
    }
}
