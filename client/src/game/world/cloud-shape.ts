import { seeded } from './draw-utils';

// 밟는 구름 발판의 모양 (그리기는 sky-textures.ts). 텍스처 크기와 밟는 면 높이를 지키는지 테스트하려고 계산만 따로 둔다

export const CLOUD_TEXTURE_H = 80;
// 텍스처 위에서 이만큼 내려온 곳이 밟는 면 (그 위는 덩어리가 부풀 자리)
export const CLOUD_TOP = 32;
// 윤곽선 굵기. 덩어리가 텍스처 끝에 닿으면 선이 잘리므로 이만큼 띄운다
export const CLOUD_LINE = 2;

export interface Lobe
{
    x: number;
    y: number;
    r: number;
    // 앞줄(아래) 덩어리. 몸통 앞으로 튀어나와 보이게 윗둘레에 주름 선을 긋는다
    front: boolean;
}

const EDGE = CLOUD_LINE + 1;
// 뒷줄 덩어리 하나가 차지하는 너비. 짧은 구름은 2개, 쉼터 구름은 6개
const BACK_SPACING = 62;

// 뒷줄(위, 크다), 골짜기, 양 끝, 앞줄(아래, 작다) 덩어리를 겹쳐 울퉁불퉁한 윤곽을 만든다
export function cloudShape (w: number): { lobes: Lobe[] }
{
    const rand = seeded(w);
    const left = EDGE;
    const right = w - EDGE;
    const bottom = CLOUD_TEXTURE_H - EDGE;

    // 뒷줄: 가운데가 크고 양 끝이 작다
    const backCount = Math.max(2, Math.round(w / BACK_SPACING));
    const backMax = Math.min(CLOUD_TOP + 6 - EDGE, (right - left) / backCount * 0.62);
    const backRadii = Array.from({ length: backCount }, (_, i) =>
    {
        const middle = Math.sin(Math.PI * (i + 0.5) / backCount);
        return backMax * (0.72 + 0.28 * middle) - rand() * 3;
    });
    const back = spread(backRadii, left, right).map(([ x, r ]) => ({
        x, r, y: CLOUD_TOP + 6 + (backMax - r) * 0.6 + rand() * 2, front: false
    }));

    // 골짜기: 뒷줄 덩어리 사이에 작은 덩어리를 끼워 밟는 높이에 빈틈이 없게 하고, 윤곽을 더 울퉁불퉁하게 한다
    const valleys = back.slice(1).map((b, i) =>
    {
        const a = back[i];
        const r = Math.min(a.r, b.r) * 0.6;
        return { x: (a.x + b.x) / 2 + (rand() - 0.5) * 6, y: CLOUD_TOP + r * 0.3, r, front: false };
    });

    // 양 끝: 뒷줄과 앞줄 사이를 둥글게 메운다
    const sideR = backMax * 0.55;
    const sides = [ left + sideR, right - sideR ].map(x => ({ x, r: sideR, y: CLOUD_TOP + 18, front: false }));

    // 앞줄: 작은 덩어리가 아래를 울퉁불퉁하게 만든다
    const frontCount = backCount + 1;
    const frontMax = backMax * 0.62;
    const frontRadii = Array.from({ length: frontCount }, (_, i) => frontMax * (i % 2 === 0 ? 0.92 : 0.78) - rand() * 2);
    const front = spread(frontRadii, left + sideR * 0.5, right - sideR * 0.5).map(([ x, r ]) => ({
        x, r, y: bottom - r - rand() * 3, front: true
    }));

    return { lobes: [ ...back, ...valleys, ...sides, ...front ] };
}

// 양 끝 덩어리가 [from, to] 끝에 맞닿게 놓고 그 사이는 고르게 나눈다
function spread (radii: number[], from: number, to: number): [ number, number ][]
{
    const first = from + radii[0];
    const last = to - radii[radii.length - 1];
    return radii.map((r, i) => [ first + (last - first) * i / Math.max(1, radii.length - 1), r ]);
}
