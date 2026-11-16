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

    it('순위는 빠른 기록 순으로, publishable 키를 헤더에 담아 요청한다', async () =>
    {
        const m = await loadModule();
        fetchMock.mockResolvedValueOnce(jsonResponse([]));

        await m.fetchRanking(5);

        const [ url, init ] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://example.supabase.co/rest/v1/sky_records?select=*&order=time_ms.asc,created_at.asc&limit=5');
        expect((init?.headers as Record<string, string>).apikey).toBe('test-key');
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
        expect(body).toEqual({ name: '숲지기', message: 'x'.repeat(m.MESSAGE_MAX), time_ms: 20000 });
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
