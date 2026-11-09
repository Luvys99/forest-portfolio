import { VIEW_H, VIEW_W, WORLD_W } from './layout';
import { Ctx, seeded, taperedCurve } from './draw-utils';

// 배경용 텍스처: 하늘, 빛줄기, 안개, 나무 실루엣, 땅, 식물

export interface TreeLayerOptions
{
    color: string;
    count: number;
    minW: number;
    maxW: number;
    seed: number;
    branches?: number;
    xs?: number[];
}

export function drawSky (ctx: Ctx)
{
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#030d18');
    g.addColorStop(0.45, '#0a3044');
    g.addColorStop(0.8, '#0e5260');
    g.addColorStop(1, '#136b68');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 위쪽에서 은은하게 들어오는 빛
    const light = ctx.createRadialGradient(VIEW_W * 0.6, -80, 0, VIEW_W * 0.6, -80, 760);
    light.addColorStop(0, 'rgba(140,255,225,0.22)');
    light.addColorStop(1, 'rgba(140,255,225,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function drawRay (ctx: Ctx)
{
    const g = ctx.createLinearGradient(0, 0, 0, 900);
    g.addColorStop(0, 'rgba(170,255,230,0.55)');
    g.addColorStop(0.6, 'rgba(120,230,210,0.15)');
    g.addColorStop(1, 'rgba(120,230,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(95, 0);
    ctx.lineTo(145, 0);
    ctx.lineTo(240, 900);
    ctx.lineTo(0, 900);
    ctx.closePath();
    ctx.fill();
}

export function drawFog (ctx: Ctx)
{
    const rand = seeded(11);
    for (let i = 0; i < 26; i++)
    {
        const x = rand() * VIEW_W;
        const y = 80 + rand() * 120;
        const r = 120 + rand() * 160;

        // 타일이 이어지도록 양쪽에도 같이 그린다
        for (const ox of [ -VIEW_W, 0, VIEW_W ])
        {
            const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
            g.addColorStop(0, 'rgba(150,235,225,0.16)');
            g.addColorStop(1, 'rgba(150,235,225,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(x + ox, y, r, r * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export function drawGlow (ctx: Ctx, r: number, color: string)
{
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r * 2, r * 2);
}

export function drawVignette (ctx: Ctx)
{
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.7);
    g.addColorStop(0, 'rgba(0,6,14,0)');
    g.addColorStop(1, 'rgba(0,6,14,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function drawTreeLayer (ctx: Ctx, opt: TreeLayerOptions)
{
    const rand = seeded(opt.seed);
    const H = ctx.canvas.height;
    ctx.fillStyle = opt.color;
    ctx.strokeStyle = opt.color;
    ctx.lineCap = 'round';

    const count = opt.xs?.length ?? opt.count;

    for (let i = 0; i < count; i++)
    {
        const x = opt.xs ? opt.xs[i] : (i + rand() * 0.8) * (VIEW_W / count);
        const w = opt.minW + rand() * (opt.maxW - opt.minW);
        const lean = (rand() - 0.5) * w * 2;
        // 텍스처가 세로로 길면 가지도 그만큼 더 많이
        const branchCount = Math.round((opt.branches ?? 2) * H / VIEW_H);
        const branches = Array.from({ length: branchCount }, () => ({
            t: 0.15 + rand() * 0.75,
            dir: rand() > 0.5 ? 1 : -1,
            len: w * (2.5 + rand() * 3),
            rise: w * (1.5 + rand() * 2.5)
        }));

        for (const ox of [ -VIEW_W, 0, VIEW_W ])
        {
            drawTrunk(ctx, x + ox, H, -40, w, lean);

            for (const b of branches)
            {
                const by = H - (H + 40) * b.t;
                const bx = x + ox + lean * b.t;
                taperedCurve(ctx, [
                    bx, by,
                    bx + b.dir * b.len * 0.4, by - b.rise * 0.1,
                    bx + b.dir * b.len * 0.75, by - b.rise * 0.5,
                    bx + b.dir * b.len, by - b.rise
                ], w * 0.3, w * 0.04);
            }
        }
    }
}

export function drawTrunk (ctx: Ctx, x: number, baseY: number, topY: number, w: number, lean: number)
{
    const midY = (baseY + topY) / 2;
    ctx.beginPath();
    ctx.moveTo(x - w * 1.6, baseY);
    ctx.quadraticCurveTo(x - w * 0.55, baseY - w * 0.6, x - w * 0.5, baseY - w * 1.6);
    ctx.bezierCurveTo(x - w * 0.5 + lean * 0.4, midY, x - w * 0.35 + lean, topY + 80, x - w * 0.3 + lean, topY);
    ctx.lineTo(x + w * 0.3 + lean, topY);
    ctx.bezierCurveTo(x + w * 0.35 + lean, topY + 80, x + w * 0.5 + lean * 0.4, midY, x + w * 0.5, baseY - w * 1.6);
    ctx.quadraticCurveTo(x + w * 0.55, baseY - w * 0.6, x + w * 1.6, baseY);
    ctx.closePath();
    ctx.fill();
}


export function drawVine (ctx: Ctx)
{
    ctx.strokeStyle = 'rgba(120,255,150,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.bezierCurveTo(6, 60, 18, 120, 12, 200);
    ctx.stroke();

    // 덩굴 끝과 중간의 빛나는 방울
    [ [ 11, 70, 4 ], [ 14, 130, 5 ], [ 12, 200, 8 ] ].forEach(([ x, y, r ]) =>
    {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
        g.addColorStop(0, 'rgba(230,255,200,1)');
        g.addColorStop(0.4, 'rgba(140,255,120,0.9)');
        g.addColorStop(1, 'rgba(140,255,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
        ctx.fill();
    });
}

export function drawPlant (ctx: Ctx)
{
    ctx.strokeStyle = '#1d5a4c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(20, 70);
    ctx.quadraticCurveTo(14, 50, 20, 30);
    ctx.stroke();

    const g = ctx.createRadialGradient(20, 26, 0, 20, 26, 12);
    g.addColorStop(0, '#eafff8');
    g.addColorStop(0.5, '#62f2d4');
    g.addColorStop(1, 'rgba(60,200,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(20, 26, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
}

export function drawGround (ctx: Ctx)
{
    const rand = seeded(31);
    const top = (x: number) => 40 + Math.sin(x / 180) * 6 + Math.sin(x / 47) * 2;

    const g = ctx.createLinearGradient(0, 30, 0, 160);
    g.addColorStop(0, '#1b5f55');
    g.addColorStop(0.2, '#0b2c34');
    g.addColorStop(1, '#03121a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 160);
    for (let x = 0; x <= WORLD_W; x += 8)
    {
        ctx.lineTo(x, top(x));
    }
    ctx.lineTo(WORLD_W, 160);
    ctx.closePath();
    ctx.fill();

    // 이끼 하이라이트
    ctx.strokeStyle = 'rgba(80,200,150,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 8)
    {
        ctx.lineTo(x, top(x) + 1);
    }
    ctx.stroke();

    // 풀
    ctx.strokeStyle = 'rgba(60,170,130,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 500; i++)
    {
        const x = rand() * WORLD_W;
        const y = top(x) + 2;
        const h = 6 + rand() * 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (rand() - 0.5) * 8, y - h * 0.6, x + (rand() - 0.5) * 10, y - h);
        ctx.stroke();
    }
}
