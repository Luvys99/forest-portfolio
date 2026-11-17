// Supabase REST API 공통 (기록: skyRecords.ts, 방명록: guestbook.ts)
// 서버를 직접 운영하지 않고, Supabase가 테이블마다 만들어 주는 REST API를 fetch로 부른다.
// 누가 무엇을 할 수 있는지는 DB의 RLS 정책이 정한다 (읽기 + 쓰기만, 수정·삭제 불가)

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnabled = Boolean(URL && KEY);

export async function send (path: string, init: RequestInit = {}): Promise<Response>
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

    return response;
}

export async function request<T> (path: string, init: RequestInit = {}): Promise<T>
{
    const response = await send(path, init);
    return response.status === 204 ? (undefined as T) : response.json();
}

// 한 줄을 쓰고 저장된 행을 돌려받는다 (내 글·기록을 목록에서 강조하려고)
export async function insertRow<T> (table: string, columns: string, row: object): Promise<T>
{
    const [ saved ] = await request<T[]>(`${table}?select=${columns}`, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row)
    });
    return saved;
}

// 연속 작성 막기 (브라우저 기준이라 완전한 방어는 아니다)
export class WriteCooldown
{
    constructor (private readonly storageKey: string, private readonly ms: number) {}

    // 남았으면 안내 문구와 함께 실패한다
    check ()
    {
        const wait = this.left();
        if (wait > 0)
        {
            throw new Error(`${Math.ceil(wait / 1000)}초 뒤에 다시 남길 수 있어요`);
        }
    }

    mark ()
    {
        try
        {
            localStorage.setItem(this.storageKey, String(Date.now()));
        }
        catch
        {
            // 저장소가 막혀 있으면 쿨다운 없이 넘어간다
        }
    }

    private left ()
    {
        try
        {
            const last = Number(localStorage.getItem(this.storageKey)) || 0;
            return Math.max(0, last + this.ms - Date.now());
        }
        catch
        {
            return 0;
        }
    }
}
