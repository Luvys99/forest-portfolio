// 점프맵 클리어 기록과 순위표 (Supabase sky_records 테이블, sky_ranking 뷰)

import { NAME_MAX } from './guestbook';
import { insertRow, send, WriteCooldown } from './supabase';

// 클리어하는 데 15초는 걸리므로(DB check 제약) 그보다 자주 남길 일은 없다
const cooldown = new WriteCooldown('forest-portfolio:record-last-write', 15_000);

export interface SkyRecord
{
    id: number;
    name: string;
    time_ms: number;
    created_at: string;
}

export interface Ranking
{
    records: SkyRecord[];
    // 순위표에 오른 이름 수 = 달에 닿은 사람 수
    players: number;
}

const COLUMNS = 'id,name,time_ms,created_at';

// 이름마다 가장 빠른 기록 하나씩, 빠른 순 (sky_ranking 뷰가 고른다)
export async function fetchRanking (limit = 10): Promise<Ranking>
{
    const response = await send(`sky_ranking?select=${COLUMNS}&order=time_ms.asc,created_at.asc&limit=${limit}`, {
        // 전체 줄 수를 Content-Range 의 "/" 뒤에 받는다 (예: "0-9/42")
        headers: { Prefer: 'count=exact' }
    });
    const records: SkyRecord[] = await response.json();
    const total = Number(response.headers.get('Content-Range')?.split('/')[1]);
    return { records, players: Number.isFinite(total) ? total : records.length };
}

export async function addRecord (name: string, timeMs: number)
{
    cooldown.check();
    const record = await insertRow<SkyRecord>('sky_records', COLUMNS, {
        name: name.trim().slice(0, NAME_MAX),
        time_ms: Math.round(timeMs)
    });
    cooldown.mark();
    return record;
}
