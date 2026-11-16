import { describe, expect, it } from 'vitest';
import { decayLandSquash, PoseInput, spiritPose, WALK_SPEED } from './spirit-pose';

const base: PoseInput = { mode: 'ground', vx: 0, vy: 0, time: 0, climbY: 0, landSquash: 0 };

describe('spiritPose', () =>
{
    it('서 있으면 숨만 쉰다: 위아래로 늘어난 만큼 옆으로 줄고, 기울지 않는다', () =>
    {
        for (const time of [ 0, 300, 700, 1200 ])
        {
            const pose = spiritPose({ ...base, time });
            expect(pose.offsetY).toBe(0);
            expect(pose.rotation).toBe(0);
            expect(pose.sx + pose.sy).toBeCloseTo(2);
        }
    });

    it('달리면 통통 튀고(최대 5px) 진행 방향으로 기운다', () =>
    {
        for (const time of [ 0, 50, 100, 170 ])
        {
            const right = spiritPose({ ...base, vx: WALK_SPEED + 1, time });
            const left = spiritPose({ ...base, vx: -(WALK_SPEED + 1), time });
            expect(right.offsetY).toBeLessThanOrEqual(0);
            expect(right.offsetY).toBeGreaterThanOrEqual(-5);
            expect(right.rotation).toBeGreaterThan(0);
            expect(left.rotation).toBeLessThan(0);
        }
    });

    it('올라갈 때 늘어나고, 아무리 빨라도 늘어남에는 한계가 있다', () =>
    {
        const rising = spiritPose({ ...base, mode: 'air', vy: -600 });
        const falling = spiritPose({ ...base, mode: 'air', vy: 600 });
        const extreme = spiritPose({ ...base, mode: 'air', vy: -1e9 });
        expect(rising.sy).toBeGreaterThan(1);
        expect(falling.sy).toBeLessThan(1);
        expect(extreme.sy).toBeCloseTo(1.18);
    });

    it('착지 직후에는 눌렸다가, 0.35초 뒤에는 거의 원래대로 돌아온다', () =>
    {
        const landed = spiritPose({ ...base, landSquash: 1 });
        expect(landed.sy).toBeLessThan(0.8);
        expect(landed.sx).toBeGreaterThan(1.1);

        expect(decayLandSquash(1, 0)).toBe(1);
        expect(decayLandSquash(1, 350)).toBeCloseTo(0.0001);
        // 프레임을 잘게 나눠도 같은 결과
        let squash = 1;
        for (let i = 0; i < 21; i++)
        {
            squash = decayLandSquash(squash, 350 / 21);
        }
        expect(squash).toBeCloseTo(0.0001);
    });
});
