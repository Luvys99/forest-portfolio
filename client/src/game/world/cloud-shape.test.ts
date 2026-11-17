import { describe, expect, it } from 'vitest';
import { CLOUD_TEXTURE_H, CLOUD_TOP, cloudShape } from './cloud-shape';
import { CLOUDS, GOAL } from './sky-layout';

const widths = [ ...new Set([ ...CLOUDS, GOAL ].map(c => c.w)) ];

describe('cloudShape', () =>
{
    it.each(widths)('너비 %i 구름이 텍스처 안에 들어간다', w =>
    {
        const { puffs, base } = cloudShape(w);
        for (const p of puffs)
        {
            expect(p.x - p.r).toBeGreaterThanOrEqual(0);
            expect(p.x + p.r).toBeLessThanOrEqual(w);
            expect(p.y - p.r).toBeGreaterThanOrEqual(0);
        }
        expect(base.bottom).toBeLessThanOrEqual(CLOUD_TEXTURE_H);
    });

    it.each(widths)('너비 %i 구름의 밟는 면이 구름 속에 있다 (발이 허공에 뜨지 않는다)', w =>
    {
        const { puffs, base } = cloudShape(w);
        expect(base.top).toBeLessThanOrEqual(CLOUD_TOP + 8);
        expect(Math.min(...puffs.map(p => p.y - p.r))).toBeLessThan(CLOUD_TOP);
        // 양 끝 덩어리가 밟을 수 있는 범위(0~w)의 끝을 덮는다
        expect(puffs[0].x - puffs[0].r).toBeLessThanOrEqual(8);
        expect(puffs[puffs.length - 1].x + puffs[puffs.length - 1].r).toBeGreaterThanOrEqual(w - 8);
    });

    it('같은 너비는 항상 같은 모양이다', () =>
    {
        expect(cloudShape(140)).toEqual(cloudShape(140));
    });
});
