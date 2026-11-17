import { afterEach, describe, expect, it, vi } from 'vitest';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 브라우저 localStorage 흉내
function fakeStorage (initial: Record<string, string> = {})
{
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        map
    };
}

// 모듈 안의 대체 id 를 테스트마다 비우려고 다시 불러온다
async function load ()
{
    vi.resetModules();
    return (await import('./playerId')).getPlayerId;
}

describe('getPlayerId', () =>
{
    afterEach(() => vi.unstubAllGlobals());

    it('처음이면 uuid v4 를 만들어 저장하고, 다음에는 같은 값을 돌려준다', async () =>
    {
        const storage = fakeStorage();
        vi.stubGlobal('localStorage', storage);
        const getPlayerId = await load();

        const id = getPlayerId();
        expect(id).toMatch(UUID_V4);
        expect(storage.map.get('forest-portfolio:player-id')).toBe(id);
        expect(getPlayerId()).toBe(id);
    });

    it('저장된 값이 uuid 가 아니면 새로 만든다', async () =>
    {
        vi.stubGlobal('localStorage', fakeStorage({ 'forest-portfolio:player-id': 'hello' }));
        const getPlayerId = await load();

        expect(getPlayerId()).toMatch(UUID_V4);
    });

    it('저장소가 막혀 있어도 이번 접속 동안은 같은 id 를 쓴다', async () =>
    {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        });
        const getPlayerId = await load();

        const id = getPlayerId();
        expect(id).toMatch(UUID_V4);
        expect(getPlayerId()).toBe(id);
    });
});
