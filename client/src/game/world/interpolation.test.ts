import { describe, expect, it } from 'vitest';
import { FOLLOW_RATE, followPoint, SNAP_DISTANCE } from './interpolation';

const FRAME = 1000 / 60;

describe('followPoint', () =>
{
    it('60fps 한 프레임에 남은 거리의 20% 만큼 다가간다', () =>
    {
        const next = followPoint({ x: 0, y: 0 }, { x: 100, y: -50 }, FRAME);
        expect(next.x).toBeCloseTo(100 * FOLLOW_RATE);
        expect(next.y).toBeCloseTo(-50 * FOLLOW_RATE);
    });

    it('프레임 속도가 달라도 같은 시간이 지나면 같은 위치에 있다', () =>
    {
        let at60 = { x: 0, y: 0 };
        for (let i = 0; i < 6; i++)
        {
            at60 = followPoint(at60, { x: 300, y: 0 }, FRAME);
        }
        let at30 = { x: 0, y: 0 };
        for (let i = 0; i < 3; i++)
        {
            at30 = followPoint(at30, { x: 300, y: 0 }, FRAME * 2);
        }
        expect(at30.x).toBeCloseTo(at60.x);
    });

    it('목표를 지나치지 않고 결국 도착한다', () =>
    {
        let p = { x: 0, y: 0 };
        for (let i = 0; i < 120; i++)
        {
            p = followPoint(p, { x: 200, y: 100 }, FRAME);
            expect(p.x).toBeLessThanOrEqual(200);
        }
        expect(p.x).toBeCloseTo(200, 1);
        expect(p.y).toBeCloseTo(100, 1);
    });

    it('시간이 흐르지 않으면 움직이지 않는다', () =>
    {
        expect(followPoint({ x: 5, y: 5 }, { x: 50, y: 50 }, 0)).toEqual({ x: 5, y: 5 });
    });

    it('너무 멀면(포탈, 재접속) 따라가지 않고 바로 옮긴다', () =>
    {
        expect(followPoint({ x: 0, y: 0 }, { x: SNAP_DISTANCE + 1, y: 0 }, FRAME)).toEqual({ x: SNAP_DISTANCE + 1, y: 0 });
        expect(followPoint({ x: 0, y: 0 }, { x: SNAP_DISTANCE - 1, y: 0 }, FRAME).x).toBeLessThan(SNAP_DISTANCE - 1);
    });
});
