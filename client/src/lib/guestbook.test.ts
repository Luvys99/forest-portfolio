import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import guestbookSql from '../../../supabase/guestbook.sql?raw';
import recordsSql from '../../../supabase/sky_records.sql?raw';

// supabase.ts 는 import 시점에 환경변수를 읽으므로, 값을 넣은 뒤 다시 불러온다
async function loadModule ()
{
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    return import('./guestbook');
}

function jsonResponse (body: unknown, status = 200)
{
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('guestbook', () =>
{
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() =>
    {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        // 쓰기 쿨다운이 테스트끼리 이어지지 않게 저장소를 새로 둔다
        const map = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => void map.set(k, v)
        });
    });

    afterEach(() =>
    {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('방명록은 guestbook 테이블에서 최근 글 순으로 읽는다', async () =>
    {
        const m = await loadModule();
        fetchMock.mockResolvedValueOnce(jsonResponse([]));

        await m.fetchGuestbook(5);

        expect(String(fetchMock.mock.calls[0][0]))
            .toBe('https://example.supabase.co/rest/v1/guestbook?select=id,name,message,created_at&order=created_at.desc,id.desc&limit=5');
    });

    it('글을 남길 때 이름·한마디를 다듬고 길이를 자른다 (기록과 상관없다)', async () =>
    {
        const m = await loadModule();
        const saved = { id: 1, name: '숲지기', message: '안녕', created_at: '2026-01-01T00:00:00Z' };
        fetchMock.mockResolvedValueOnce(jsonResponse([ saved ]));

        expect(await m.addGuestbookEntry('  숲지기  ', ' ' + 'x'.repeat(100))).toEqual(saved);

        const [ url, init ] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('https://example.supabase.co/rest/v1/guestbook?select=id,name,message,created_at');
        expect(JSON.parse(String(init?.body))).toEqual({ name: '숲지기', message: 'x'.repeat(m.MESSAGE_MAX) });
    });

    it('연달아 남기면 쿨다운 안내와 함께 실패하고 요청을 보내지 않는다', async () =>
    {
        const m = await loadModule();
        fetchMock.mockResolvedValue(jsonResponse([ {} ]));

        await m.addGuestbookEntry('숲지기', '안녕');
        await expect(m.addGuestbookEntry('숲지기', '또 안녕')).rejects.toThrow(/초 뒤에 다시 남길 수 있어요/);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // 같은 규칙이 세 곳(클라이언트, DB check 제약, 중계 서버)에 손으로 적혀 있다.
    // 여기서는 DB와 맞는지 본다. 서버 쪽은 server/src/test 의 ValidationTest 가 같은 SQL을 읽는다
    it('이름·한마디 길이 제한이 supabase/*.sql 의 check 제약과 같다', async () =>
    {
        const m = await loadModule();
        const name = new RegExp(`char_length\\(name\\) between 1 and ${m.NAME_MAX}\\b`);

        expect(guestbookSql).toMatch(name);
        expect(recordsSql).toMatch(name);
        expect(guestbookSql).toMatch(new RegExp(`char_length\\(message\\) between 1 and ${m.MESSAGE_MAX}\\b`));
    });
});
