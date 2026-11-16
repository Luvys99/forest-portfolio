import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIdentity, isPaletteColor, loadIdentity, normalizeName, PALETTE, saveIdentity } from './identity';
import { NAME_MAX } from './skyRecords';

// 브라우저 sessionStorage 흉내
function fakeStorage ()
{
    const map = new Map<string, string>();
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k)
    };
}

describe('normalizeName', () =>
{
    it('서버와 같은 규칙으로 다듬는다: 앞뒤 공백·제어 문자 제거, 1~12자', () =>
    {
        expect(normalizeName('  숲지기  ')).toBe('숲지기');
        expect(normalizeName('a\u0007b')).toBe('ab');
        expect(normalizeName('   ')).toBeNull();
        expect(normalizeName('')).toBeNull();
        expect(normalizeName('x'.repeat(NAME_MAX))).toBe('x'.repeat(NAME_MAX));
        expect(normalizeName('x'.repeat(NAME_MAX + 1))).toBeNull();
    });
});

describe('PALETTE', () =>
{
    it('색은 hex 6자리 소문자이고(서버 형식) 서로 다르다', () =>
    {
        for (const { hex } of PALETTE)
        {
            expect(hex).toMatch(/^[0-9a-f]{6}$/);
            expect(isPaletteColor(hex)).toBe(true);
        }
        expect(new Set(PALETTE.map(c => c.hex)).size).toBe(PALETTE.length);
        expect(isPaletteColor('000000')).toBe(false);
    });
});

describe('loadIdentity / saveIdentity', () =>
{
    beforeEach(() => vi.stubGlobal('sessionStorage', fakeStorage()));
    afterEach(() => vi.unstubAllGlobals());

    it('저장한 값을 그대로 돌려주고, 지우면 다시 묻는다', () =>
    {
        expect(loadIdentity()).toBeNull();
        saveIdentity({ name: '숲지기', color: 'ffd34d' });
        expect(loadIdentity()).toEqual({ name: '숲지기', color: 'ffd34d' });
        clearIdentity();
        expect(loadIdentity()).toBeNull();
    });

    it('저장된 값이 규칙에 어긋나면 버린다', () =>
    {
        sessionStorage.setItem('forest-portfolio:identity', 'not json');
        expect(loadIdentity()).toBeNull();
        sessionStorage.setItem('forest-portfolio:identity', JSON.stringify({ name: '', color: 'ffd34d' }));
        expect(loadIdentity()).toBeNull();
        sessionStorage.setItem('forest-portfolio:identity', JSON.stringify({ name: '숲지기', color: 'ff0000' }));
        expect(loadIdentity()).toBeNull();
        sessionStorage.setItem('forest-portfolio:identity', JSON.stringify({ name: 7, color: 'ffd34d' }));
        expect(loadIdentity()).toBeNull();
    });

    it('저장소가 막혀 있어도 게임은 계속된다', () =>
    {
        vi.stubGlobal('sessionStorage', {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); },
            removeItem: () => { throw new Error('blocked'); }
        });
        expect(loadIdentity()).toBeNull();
        expect(() => saveIdentity({ name: '숲지기', color: 'ffd34d' })).not.toThrow();
        expect(() => clearIdentity()).not.toThrow();
    });
});
