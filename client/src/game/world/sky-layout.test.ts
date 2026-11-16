import { describe, expect, it } from 'vitest';
import { MAX_JUMP_HEIGHT } from '../physics';
import { CLOUDS, GOAL, SKY_GROUND_Y, SKY_H } from './sky-layout';

// 점프맵이 "클리어 가능한 맵"으로 남아 있는지.
// 점프 속도(physics.ts)나 구름 배치(sky-layout.ts) 어느 쪽을 바꿔도 이 테스트가 먼저 알려 준다.
describe('sky-layout', () =>
{
    const steps = [ ...CLOUDS, GOAL ];

    it('모든 구름은 바로 앞 구름에서 한 번의 점프로 닿을 수 있는 높이에 있다', () =>
    {
        // 히트박스가 발판 위에 올라서야 하므로 최고 높이에서 여유를 둔다
        const reachable = MAX_JUMP_HEIGHT * 0.9;
        let prevY = SKY_GROUND_Y;
        for (const cloud of steps)
        {
            const rise = prevY - cloud.y;
            expect(rise, `구름 (${cloud.x}, ${cloud.y}) 는 앞 구름보다 ${rise}px 높다`).toBeLessThanOrEqual(reachable);
            prevY = cloud.y;
        }
    });

    it('구름은 전부 맵 안에 있고, 달 구름이 가장 높다', () =>
    {
        for (const cloud of steps)
        {
            expect(cloud.y).toBeGreaterThan(0);
            expect(cloud.y).toBeLessThanOrEqual(SKY_GROUND_Y);
            expect(cloud.w).toBeGreaterThan(0);
        }
        expect(Math.min(...steps.map(c => c.y))).toBe(GOAL.y);
        expect(SKY_H).toBeGreaterThan(SKY_GROUND_Y);
    });
});
