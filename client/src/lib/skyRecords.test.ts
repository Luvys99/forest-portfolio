import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sql from '../../../supabase/sky_records.sql?raw';

// skyRecords.ts 는 import 시점에 환경변수를 읽으므로, 값을 넣은 뒤 다시 불러온다
async function loadModule (url = 'https://example.supabase.co', key = 'test-key')
{
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
    return import('./skyRecords');
}

function jsonResponse (body: unknown, status = 200)
{
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('skyRecords', () =>
{
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() =>
    {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() =>
    {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('설정이 없으면 방명록을 끈다', async () =>
    {
        const m = await loadModule('', '');
        expect(m.guestbookEnabled).toBe(false);
        await expect(m.fetchRanking()).rejects.toThrow('방명록 설정이 없습니다');
    });

    it('순위는 브라우저별 최고 기록 뷰에서 빠른 순으로, publishable 키를 헤더에 담아 요청한다', async () =>
    {
        const m = await loadModule();
        fetchMock.mockResolvedValueOnce(jsonResponse([]));

        await m.fetchRanking(5);

        const [ url, init ] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://example.supabase.co/rest/v1/sky_ranking?select=id,name,message,time_ms,created_at&order=time_ms.asc,created_at.asc&limit=5');
        expect((init?.headers as Record<string, string>).apikey).toBe('test-key');
        expect((init?.headers as Record<string, string>).Prefer).toBe('count=exact');
    });

    it('순위표에 오른 사람 수를 Content-Range 에서 읽는다', async () =>
    {
        const m = await loadModule();
        const response = jsonResponse([]);
        response.headers.set('Content-Range', '0-9/42');
        fetchMock.mockResolvedValueOnce(response);

        expect((await m.fetchRanking()).players).toBe(42);
    });

    it('브라우저 id 칸은 읽지 않는다 (DB가 남에게 읽기를 허락하지 않는다)', async () =>
    {
        const m = await loadModule();
        fetchMock.mockImplementation(async () => jsonResponse([ {} ]));

        await m.fetchRanking();
        await m.fetchRecent();
        await m.addRecord('숲지기', '', 20000).catch(() => undefined);

        for (const [ url ] of fetchMock.mock.calls)
        {
            expect(String(url)).not.toContain('select=*');
            expect(String(url)).not.toContain('player_id');
        }
    });

    it('기록을 남길 때 이름·한마디를 다듬고 길이를 자르며, 저장된 행을 돌려받는다', async () =>
    {
        const m = await loadModule();
        const saved = { id: 1, name: '숲지기', message: '', time_ms: 20000, created_at: '2026-01-01T00:00:00Z' };
        fetchMock.mockResolvedValueOnce(jsonResponse([ saved ]));

        const record = await m.addRecord('  숲지기  ', 'x'.repeat(100), 19999.6);

        const [ , init ] = fetchMock.mock.calls[0];
        const body = JSON.parse(String(init?.body));
        expect(init?.method).toBe('POST');
        expect((init?.headers as Record<string, string>).Prefer).toBe('return=representation');
        expect(body).toMatchObject({ name: '숲지기', message: 'x'.repeat(m.MESSAGE_MAX), time_ms: 20000 });
        expect(body.player_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(record).toEqual(saved);
    });

    it('서버가 거절하면 상태 코드를 담아 실패한다', async () =>
    {
        const m = await loadModule();
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nope' }, 400));

        await expect(m.fetchRecent()).rejects.toThrow('방명록 요청 실패 (400)');
    });

    // 같은 규칙이 세 곳(클라이언트, DB check 제약, 중계 서버)에 손으로 적혀 있다.
    // 여기서는 DB와 맞는지 본다. 서버 쪽은 server/src/test 의 ValidationTest 가 같은 SQL을 읽는다
    it('이름·한마디 길이 제한이 supabase/sky_records.sql 의 check 제약과 같다', async () =>
    {
        const m = await loadModule();

        expect(sql).toMatch(new RegExp(`char_length\\(name\\) between 1 and ${m.NAME_MAX}\\b`));
        expect(sql).toMatch(new RegExp(`char_length\\(message\\) <= ${m.MESSAGE_MAX}\\b`));
    });
});
