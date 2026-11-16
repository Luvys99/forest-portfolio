import { describe, expect, it } from 'vitest';
import { seeded } from './draw-utils';

describe('seeded', () =>
{
    it('같은 시드는 항상 같은 숲을 그린다', () =>
    {
        const a = seeded(7);
        const b = seeded(7);
        for (let i = 0; i < 100; i++)
        {
            expect(a()).toBe(b());
        }
    });

    it('0 이상 1 미만의 값을 낸다', () =>
    {
        const rand = seeded(3);
        for (let i = 0; i < 1000; i++)
        {
            const v = rand();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});
