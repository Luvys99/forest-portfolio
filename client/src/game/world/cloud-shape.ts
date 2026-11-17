import { seeded } from './draw-utils';

// 밟는 구름 발판의 모양 (그리기는 sky-textures.ts). 텍스처 크기와 밟는 면 높이를 지키는지 테스트하려고 계산만 따로 둔다

export const CLOUD_TEXTURE_H = 72;
// 텍스처 위에서 이만큼 내려온 곳이 밟는 면 (그 위는 덩어리가 부풀 자리)
export const CLOUD_TOP = 30;

export interface Puff
{
    x: number;
    y: number;
    r: number;
}

export interface CloudShape
{
    // 위쪽 몽실몽실한 덩어리 (가운데가 크고 양 끝이 작다)
    puffs: Puff[];
    // 납작한 아랫부분 (양 끝이 둥근 막대)
    base: { left: number; right: number; top: number; bottom: number };
}

const PUFF_Y = CLOUD_TOP + 10;
// 덩어리 꼭대기가 텍스처 위로 잘리지 않을 만큼
const PUFF_R_MAX = PUFF_Y - 2;
const PUFF_R_MIN = 10;
const SIDE_PAD = 4;
// 덩어리 하나가 차지하는 너비. 짧은 구름은 3개, 쉼터 구름은 6~7개
const PUFF_SPACING = 56;

export function cloudShape (w: number): CloudShape
{
    const rand = seeded(w);
    const base = { left: SIDE_PAD, right: w - SIDE_PAD, top: CLOUD_TOP + 4, bottom: CLOUD_TEXTURE_H - 12 };

    const count = Math.max(3, Math.round(w / PUFF_SPACING));
    const biggest = Math.min(PUFF_R_MAX, (w - SIDE_PAD * 2) / count * 0.85);
    const radii = Array.from({ length: count }, (_, i) =>
    {
        // 0(양 끝) → 1(가운데)
        const middle = Math.sin(Math.PI * (i + 0.5) / count);
        // 크고 작은 덩어리가 번갈아 있어야 줄 선 혹처럼 보이지 않는다
        const wobble = i % 2 === 1 ? 0.82 : 1;
        const r = biggest * (0.5 + 0.5 * middle) * wobble - rand() * 3;
        return Math.max(PUFF_R_MIN, r);
    });

    // 양 끝 덩어리가 아랫부분의 둥근 끝과 맞닿게 놓고, 그 사이는 고르게 나눈다
    const first = base.left + radii[0];
    const last = base.right - radii[count - 1];
    const puffs = radii.map((r, i) => ({
        x: first + (last - first) * i / (count - 1),
        // 작은 덩어리는 조금 낮게 내려 둥근 윤곽을 만든다
        y: PUFF_Y + (biggest - r) * 0.45,
        r
    }));

    return { puffs, base };
}
