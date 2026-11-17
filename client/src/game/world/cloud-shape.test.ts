import { describe, expect, it } from 'vitest';
import { CLOUD_LINE, CLOUD_TEXTURE_H, CLOUD_TOP, cloudShape } from './cloud-shape';
import { CLOUDS, GOAL } from './sky-layout';

const widths = [ ...new Set([ ...CLOUDS, GOAL ].map(c => c.w)) ];

describe('cloudShape', () =>
{
    it.each(widths)('너비 %i 구름이 윤곽선까지 텍스처 안에 들어간다', w =>
    {
        for (const { x, y, r } of cloudShape(w).lobes)
        {
            expect(x - r - CLOUD_LINE / 2).toBeGreaterThanOrEqual(0);
            expect(x + r + CLOUD_LINE / 2).toBeLessThanOrEqual(w);
            expect(y - r - CLOUD_LINE / 2).toBeGreaterThanOrEqual(0);
            expect(y + r + CLOUD_LINE / 2).toBeLessThanOrEqual(CLOUD_TEXTURE_H);
        }
    });

    it.each(widths)('너비 %i 구름의 밟는 면이 구름 속에 있다 (발이 허공에 뜨지 않는다)', w =>
    {
        const { lobes } = cloudShape(w);
        // 밟는 면 위로 덩어리가 솟아 있고
        expect(Math.min(...lobes.map(l => l.y - l.r))).toBeLessThan(CLOUD_TOP);
        // 밟는 면 높이에서 왼쪽 끝부터 오른쪽 끝까지 덩어리가 빈틈없이 덮는다
        for (let x = 10; x <= w - 10; x += 2)
        {
            expect(lobes.some(l => Math.hypot(x - l.x, CLOUD_TOP - l.y) < l.r)).toBe(true);
        }
    });

    it.each(widths)('너비 %i 구름의 아래가 평평하지 않고 앞줄 덩어리로 울퉁불퉁하다', w =>
    {
        const front = cloudShape(w).lobes.filter(l => l.front);
        expect(front.length).toBeGreaterThanOrEqual(3);
    });

    it('같은 너비는 항상 같은 모양이다', () =>
    {
        expect(cloudShape(140)).toEqual(cloudShape(140));
    });
});
