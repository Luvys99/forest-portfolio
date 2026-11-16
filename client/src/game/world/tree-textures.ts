import { BIG_TREE_H, BIG_TREE_W, FLOOR_1_Y, FLOOR_2_Y, toTreeY } from './layout';
import { Ctx, radialGlow, seeded, taperedCurve } from './draw-utils';

// 큰 황금 나무: 굵은 줄기 + 위쪽에 넓게 퍼진 황금 잎
export function drawBigTree (ctx: Ctx)
{
    const rand = seeded(21);
    const cx = BIG_TREE_W / 2;
    const H = BIG_TREE_H;

    const bark = ctx.createLinearGradient(cx - 260, 0, cx + 260, 0);
    bark.addColorStop(0, '#34609c');
    bark.addColorStop(0.45, '#1c3a6c');
    bark.addColorStop(1, '#0e2045');
    ctx.fillStyle = bark;
    ctx.strokeStyle = bark;

    // 줄기 (아래는 뿌리처럼 넓게, 위로 갈수록 살짝 비틀리며 좁아짐)
    ctx.beginPath();
    ctx.moveTo(cx - 430, H);
    ctx.quadraticCurveTo(cx - 190, H - 60, cx - 165, H - 170);
    ctx.bezierCurveTo(cx - 140, H - 450, cx - 200, H - 700, cx - 120, H - 940);
    ctx.lineTo(cx + 130, H - 940);
    ctx.bezierCurveTo(cx + 200, H - 700, cx + 145, H - 450, cx + 170, H - 170);
    ctx.quadraticCurveTo(cx + 200, H - 60, cx + 440, H);
    ctx.closePath();
    ctx.fill();

    // 뿌리
    taperedCurve(ctx, [ cx - 140, H - 100, cx - 280, H - 50, cx - 420, H - 20, cx - 600, H ], 70, 10);
    taperedCurve(ctx, [ cx + 140, H - 100, cx + 290, H - 50, cx + 430, H - 20, cx + 610, H ], 70, 10);
    taperedCurve(ctx, [ cx - 60, H - 40, cx - 120, H - 10, cx - 200, H, cx - 260, H ], 40, 8);

    // 큰 가지 (잎 속으로 뻗음)
    taperedCurve(ctx, [ cx - 60, H - 900, cx - 250, H - 1020, cx - 450, H - 1100, cx - 720, H - 1230 ], 150, 30);
    taperedCurve(ctx, [ cx + 60, H - 900, cx + 260, H - 1010, cx + 480, H - 1110, cx + 730, H - 1240 ], 150, 30);
    taperedCurve(ctx, [ cx, H - 900, cx + 40, H - 1100, cx - 40, H - 1300, cx + 10, H - 1480 ], 170, 40);
    taperedCurve(ctx, [ cx - 450, H - 1100, cx - 600, H - 1080, cx - 800, H - 1100, cx - 960, H - 1060 ], 45, 10);
    taperedCurve(ctx, [ cx + 480, H - 1110, cx + 650, H - 1090, cx + 850, H - 1100, cx + 980, H - 1050 ], 45, 10);
    taperedCurve(ctx, [ cx - 20, H - 1180, cx - 200, H - 1280, cx - 300, H - 1370, cx - 380, H - 1440 ], 50, 10);
    taperedCurve(ctx, [ cx + 20, H - 1200, cx + 200, H - 1280, cx + 320, H - 1370, cx + 400, H - 1440 ], 50, 10);

    // 발판이 붙는 자리의 옹이
    for (const wy of [ FLOOR_1_Y, FLOOR_2_Y ])
    {
        const ty = toTreeY(wy);
        for (const dir of [ -1, 1 ])
        {
            ctx.beginPath();
            ctx.ellipse(cx + dir * 150, ty + 20, 50, 34, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 나무껍질 결
    ctx.strokeStyle = 'rgba(5,15,35,0.35)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 9; i++)
    {
        const x = cx - 110 + i * 27;
        ctx.beginPath();
        ctx.moveTo(x + (rand() - 0.5) * 20, H - 120);
        ctx.bezierCurveTo(x - 40, H - 450, x + 40, H - 650, x + (rand() - 0.5) * 30, H - 920);
        ctx.stroke();
    }

    // 왼쪽 하이라이트
    ctx.strokeStyle = 'rgba(130,180,240,0.28)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(cx - 140, H - 180);
    ctx.bezierCurveTo(cx - 120, H - 450, cx - 180, H - 700, cx - 105, H - 920);
    ctx.stroke();

    // 밑동의 구멍 (아래 포탈 자리)
    const hole = ctx.createRadialGradient(cx, H - 100, 10, cx, H - 100, 110);
    hole.addColorStop(0, '#020a14');
    hole.addColorStop(0.8, '#06142a');
    hole.addColorStop(1, 'rgba(14,32,69,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.ellipse(cx, H - 100, 85, 110, 0, 0, Math.PI * 2);
    ctx.fill();

    drawCanopy(ctx, rand);
}

function drawCanopy (ctx: Ctx, rand: () => number)
{
    const cx = BIG_TREE_W / 2;

    // [중심x, 중심y, 가로 반지름, 세로 반지름]  위쪽 줄은 꼭대기를 걸을 수 있게 평평하게
    const clusters: [number, number, number, number][] = [
        [ cx - 500, 330, 300, 160 ], [ cx, 300, 420, 130 ], [ cx + 500, 330, 300, 160 ],
        [ cx - 780, 470, 280, 150 ], [ cx + 780, 470, 280, 150 ],
        [ cx - 300, 520, 300, 140 ], [ cx + 300, 520, 300, 140 ],
        [ cx - 980, 610, 190, 110 ], [ cx + 980, 610, 190, 110 ], [ cx, 600, 340, 120 ]
    ];

    for (const [ x, y, rx, ry ] of clusters)
    {
        radialGlow(ctx, x, y, Math.max(rx, ry) * 1.35, '255,205,80', 0.3);
    }

    const palette = [ '#fff4b8', '#ffe46a', '#ffd23f', '#ffbe1e', '#ee9f10', '#c27a0b' ];
    const leaves: { x: number; y: number; size: number; rot: number; color: string }[] = [];

    for (const [ ccx, ccy, rx, ry ] of clusters)
    {
        const n = Math.round(rx * 2.6);
        for (let i = 0; i < n; i++)
        {
            const a = rand() * Math.PI * 2;
            const d = Math.sqrt(rand());
            const x = ccx + Math.cos(a) * d * rx;
            const y = ccy + Math.sin(a) * d * ry;
            const shade = (y - (ccy - ry)) / (ry * 2);
            const idx = Math.min(5, Math.max(0, Math.floor((shade * 0.75 + rand() * 0.35) * 6)));
            leaves.push({ x, y, size: 10 + rand() * 13, rot: rand() * Math.PI, color: palette[idx] });
        }

        // 아래로 늘어진 잎
        for (let i = 0; i < rx * 0.25; i++)
        {
            const x = ccx + (rand() * 2 - 1) * rx * 0.8;
            const y = ccy + ry * (0.6 + rand() * 0.55);
            leaves.push({ x, y, size: 9 + rand() * 9, rot: Math.PI / 2 + (rand() - 0.5) * 0.6, color: palette[3 + Math.floor(rand() * 3)] });
        }
    }

    leaves.sort((a, b) => b.y - a.y);
    for (const l of leaves)
    {
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.ellipse(l.x, l.y, l.size, l.size * 0.55, l.rot, 0, Math.PI * 2);
        ctx.fill();
    }

    // 반짝임
    ctx.fillStyle = 'rgba(255,255,235,0.9)';
    for (let i = 0; i < 160; i++)
    {
        const l = leaves[Math.floor(rand() * leaves.length)];
        ctx.beginPath();
        ctx.arc(l.x, l.y - 3, 1.5 + rand() * 2.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 붉은 꽃
    for (let i = 0; i < 34; i++)
    {
        const [ ccx, ccy, rx, ry ] = clusters[Math.floor(rand() * clusters.length)];
        const a = rand() * Math.PI * 2;
        const fx = ccx + Math.cos(a) * rx * 0.9;
        const fy = ccy + Math.sin(a) * ry * 0.85;
        ctx.fillStyle = '#ff5e57';
        for (let p = 0; p < 5; p++)
        {
            const pa = (p / 5) * Math.PI * 2 + a;
            ctx.beginPath();
            ctx.ellipse(fx + Math.cos(pa) * 8, fy + Math.sin(pa) * 8, 8, 4.5, pa, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#ffd6a0';
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 줄기에서 뻗은 가지 발판 (오른쪽 끝이 굵은 쪽 = 줄기에 붙는 쪽)
export const PLATFORM_TOP = 12;

export function drawBranchPlatform (ctx: Ctx, w: number)
{
    const rand = seeded(w);
    const bark = ctx.createLinearGradient(0, PLATFORM_TOP, 0, 70);
    bark.addColorStop(0, '#2f5b94');
    bark.addColorStop(1, '#0e2147');
    ctx.fillStyle = bark;

    ctx.beginPath();
    ctx.moveTo(0, PLATFORM_TOP + 2);
    ctx.lineTo(w, PLATFORM_TOP - 2);
    ctx.lineTo(w, 64);
    ctx.bezierCurveTo(w * 0.6, 50, w * 0.25, 36, 0, 30);
    ctx.quadraticCurveTo(-6, 22, 0, PLATFORM_TOP + 2);
    ctx.closePath();
    ctx.fill();

    // 이끼
    ctx.strokeStyle = 'rgba(80,200,150,0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(2, PLATFORM_TOP + 1);
    ctx.lineTo(w - 2, PLATFORM_TOP - 1);
    ctx.stroke();

    // 작은 풀과 황금 잎
    for (let i = 0; i < w / 14; i++)
    {
        const x = rand() * w;
        ctx.strokeStyle = 'rgba(60,170,130,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, PLATFORM_TOP);
        ctx.lineTo(x + (rand() - 0.5) * 6, PLATFORM_TOP - 5 - rand() * 7);
        ctx.stroke();
    }
    for (let i = 0; i < w / 40; i++)
    {
        ctx.fillStyle = rand() > 0.5 ? '#ffd23f' : '#ee9f10';
        ctx.beginPath();
        ctx.ellipse(rand() * w, PLATFORM_TOP + 22 + rand() * 18, 7, 4, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 빛나는 덩굴 사다리
export const LADDER_W = 56;

export function drawLadder (ctx: Ctx, h: number)
{
    const ropes = [ 10, LADDER_W - 10 ];

    ctx.strokeStyle = 'rgba(110,230,170,0.9)';
    ctx.lineWidth = 4;
    for (const rx of ropes)
    {
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        for (let y = 0; y <= h; y += 20)
        {
            ctx.lineTo(rx + Math.sin(y / 40) * 2, y);
        }
        ctx.stroke();
    }

    ctx.strokeStyle = '#2f6f5a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let y = 24; y < h - 6; y += 30)
    {
        ctx.beginPath();
        ctx.moveTo(ropes[0], y);
        ctx.lineTo(ropes[1], y + 2);
        ctx.stroke();
    }

    for (let y = 24; y < h; y += 60)
    {
        for (const rx of ropes)
        {
            radialGlow(ctx, rx, y, 8, '170,255,190', 0.9);
        }
    }
}

// 포탈 (타원형 빛)
// 포탈 색 (안쪽 빛 3단계, 테두리, 소용돌이). 숫자는 'r,g,b'
export interface PortalColors
{
    core: string;
    mid: string;
    edge: string;
    ring: string;
    swirl: string;
}

export const GOLD_PORTAL: PortalColors = {
    core: '255,255,235',
    mid: '255,220,110',
    edge: '255,170,40',
    ring: '255,230,140',
    swirl: '255,250,210'
};

export function drawPortal (ctx: Ctx, colors: PortalColors = GOLD_PORTAL)
{
    const w = 160;
    const h = 220;
    const cx = w / 2;
    const cy = h / 2;

    const inner = ctx.createRadialGradient(cx, cy, 4, cx, cy, 80);
    inner.addColorStop(0, `rgba(${colors.core},0.95)`);
    inner.addColorStop(0.4, `rgba(${colors.mid},0.75)`);
    inner.addColorStop(1, `rgba(${colors.edge},0)`);
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62, 92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${colors.ring},0.95)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 62, 92, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 소용돌이 무늬
    ctx.strokeStyle = `rgba(${colors.swirl},0.6)`;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++)
    {
        ctx.beginPath();
        ctx.ellipse(cx, cy, 44 - i * 13, 66 - i * 19, 0.3 + i * 0.6, 0.2, Math.PI * 1.4);
        ctx.stroke();
    }
}

// 프로젝트 구슬
export function drawOrb (ctx: Ctx)
{
    const g = ctx.createRadialGradient(26, 26, 2, 32, 32, 30);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#fff6c8');
    g.addColorStop(0.75, '#ffd040');
    g.addColorStop(1, 'rgba(255,170,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
}
