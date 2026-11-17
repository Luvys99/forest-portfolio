import { VIEW_H, VIEW_W } from './layout';
import { Ctx, radialGlow, seeded } from './draw-utils';
import { cloudShape, CLOUD_TEXTURE_H } from './cloud-shape';
import { drawGlow } from './background-textures';
import { drawPortal, PortalColors } from './tree-textures';
import { makeTexture } from './textures';
import { Scene } from 'phaser';

// 밤하늘 점프맵용 텍스처: 하늘, 별, 구름, 달, 황금 잎 바닥

export const SKY_PORTAL: PortalColors = {
    core: '245,240,255',
    mid: '190,170,255',
    edge: '110,150,255',
    ring: '215,200,255',
    swirl: '235,230,255'
};

// 숲(나무 꼭대기의 입구)과 점프맵이 같이 쓰는 보랏빛 포탈
export function createSkyPortalTextures (scene: Scene)
{
    makeTexture(scene, 'portal-sky', 160, 220, ctx => drawPortal(ctx, SKY_PORTAL));
    makeTexture(scene, 'glow-sky', 512, 512, ctx => drawGlow(ctx, 256, 'rgba(170,160,255,0.6)'));
}

export function drawNightSky (ctx: Ctx)
{
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#070722');
    g.addColorStop(0.55, '#16163f');
    g.addColorStop(1, '#173a52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// 반복해서 깔 별 (가장자리를 넘는 별은 그리지 않아 이어 붙여도 티가 안 난다)
export function drawStars (ctx: Ctx, w: number, h: number, count: number, seed: number)
{
    const rand = seeded(seed);

    for (let i = 0; i < count; i++)
    {
        const x = 4 + rand() * (w - 8);
        const y = 4 + rand() * (h - 8);
        const r = 0.5 + rand() * 1.3;
        ctx.fillStyle = `rgba(${rand() < 0.2 ? '200,210,255' : '255,250,235'},${0.35 + rand() * 0.6})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 흐릿한 구름 띠 (배경)
export function drawCloudBand (ctx: Ctx, w: number, h: number, color: string, seed: number)
{
    const rand = seeded(seed);

    for (let i = 0; i < 26; i++)
    {
        const x = rand() * w;
        const y = h * 0.3 + rand() * h * 0.5;
        const r = 50 + rand() * 90;
        // 좌우로 이어 붙일 때 끊기지 않도록 반대편에도 같이 그린다
        for (const ox of [ -w, 0, w ])
        {
            radialGlow(ctx, x + ox, y, r, color, 0.18 + rand() * 0.1);
        }
    }
}

// 밟는 구름 발판 (모양은 cloud-shape.ts, 위에서 CLOUD_TOP 내려온 곳이 밟는 면)
export function drawCloudPlatform (ctx: Ctx, w: number)
{
    const { puffs, base } = cloudShape(w);
    // 아래쪽 은은한 빛. 텍스처 밖으로 넘치면 가장자리에서 잘려 네모난 테두리가 보이므로 납작한 타원으로 안에 넣는다
    const glowY = base.bottom - 4;
    const glowR = w / 2;
    ctx.save();
    ctx.translate(w / 2, glowY);
    ctx.scale(1, (CLOUD_TEXTURE_H - glowY) / glowR);
    radialGlow(ctx, 0, 0, glowR, '150,140,255', 0.22);
    ctx.restore();

    // 덩어리와 아랫부분을 한 경로로 묶는다. 따로 칠하면 반투명한 색이 겹친 자리에 원 테두리가 비친다
    const outline = () =>
    {
        const end = (base.bottom - base.top) / 2;
        ctx.beginPath();
        ctx.arc(base.left + end, base.top + end, end, Math.PI / 2, Math.PI * 1.5);
        ctx.arc(base.right - end, base.top + end, end, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        for (const p of puffs)
        {
            ctx.moveTo(p.x + p.r, p.y);
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
    };

    ctx.save();
    // 바닥은 평평하게 (가운데 큰 덩어리가 아래로 삐져나오지 않게)
    ctx.beginPath();
    ctx.rect(0, 0, w, base.bottom);
    ctx.clip();
    outline();
    ctx.clip();

    const g = ctx.createLinearGradient(0, 0, 0, base.bottom);
    g.addColorStop(0, 'rgba(253,251,255,0.98)');
    g.addColorStop(0.55, 'rgba(226,220,255,0.96)');
    g.addColorStop(1, 'rgba(170,164,238,0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, base.bottom);

    // 아랫면 그늘
    const shade = ctx.createLinearGradient(0, base.bottom - 12, 0, base.bottom);
    shade.addColorStop(0, 'rgba(120,115,215,0)');
    shade.addColorStop(1, 'rgba(120,115,215,0.35)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, base.bottom - 12, w, 12);

    // 덩어리마다 왼쪽 위에 볼록한 빛
    for (const p of puffs)
    {
        radialGlow(ctx, p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.65, '255,255,255', 0.6);
    }
    ctx.restore();
}

export function drawMoon (ctx: Ctx)
{
    const r = 90;
    const c = 160;

    radialGlow(ctx, c, c, 160, '255,240,200', 0.35);

    const g = ctx.createRadialGradient(c - 30, c - 30, 10, c, c, r);
    g.addColorStop(0, '#fffbe9');
    g.addColorStop(0.7, '#f4e7b8');
    g.addColorStop(1, '#e2cf92');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();

    // 크레이터
    ctx.fillStyle = 'rgba(200,180,120,0.35)';
    for (const [ dx, dy, cr ] of [ [ -30, -15, 16 ], [ 25, 20, 22 ], [ 10, -40, 9 ], [ -20, 40, 11 ], [ 45, -10, 8 ] ])
    {
        ctx.beginPath();
        ctx.arc(c + dx, c + dy, cr, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 시작 지점: 황금 나무 꼭대기의 잎 위
export function drawLeafFloor (ctx: Ctx, w: number, h: number)
{
    const rand = seeded(53);
    const top = (x: number) => 26 + Math.sin(x / 140) * 8 + Math.sin(x / 41) * 3;

    const g = ctx.createLinearGradient(0, 10, 0, h);
    g.addColorStop(0, '#f2c443');
    g.addColorStop(0.35, '#b9861f');
    g.addColorStop(1, '#3a2a0c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8)
    {
        ctx.lineTo(x, top(x));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 잎사귀
    const colors = [ '#ffd34d', '#ffe27a', '#f0b52e', '#ffeaa0' ];
    for (let i = 0; i < 420; i++)
    {
        const x = rand() * w;
        const y = top(x) + 4 + rand() * (h * 0.55);
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.globalAlpha = 0.55 + rand() * 0.45;
        ctx.beginPath();
        ctx.ellipse(x, y, 6 + rand() * 6, 3 + rand() * 3, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// 떨어지는 별똥별 (오른쪽 끝이 머리, 왼쪽으로 꼬리). 날아가는 방향으로 회전시켜 쓴다
export function drawMeteor (ctx: Ctx)
{
    const w = 140;
    const h = 40;
    const headX = w - 20;
    const cy = h / 2;

    const tail = ctx.createLinearGradient(0, 0, headX, 0);
    tail.addColorStop(0, 'rgba(160,200,255,0)');
    tail.addColorStop(0.7, 'rgba(200,220,255,0.45)');
    tail.addColorStop(1, 'rgba(255,240,210,0.9)');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(headX, cy - 9);
    ctx.lineTo(headX, cy + 9);
    ctx.closePath();
    ctx.fill();

    radialGlow(ctx, headX, cy, 20, '255,230,170', 0.9);
    ctx.fillStyle = '#fff8e6';
    ctx.beginPath();
    ctx.arc(headX, cy, 7, 0, Math.PI * 2);
    ctx.fill();
}

// 방명록 · 순위 표지판 (별빛 나는 작은 판)
export function drawSign (ctx: Ctx)
{
    const w = 120;
    const h = 130;

    radialGlow(ctx, w / 2, 46, 60, '190,170,255', 0.35);

    // 기둥
    ctx.fillStyle = '#3d3a78';
    ctx.fillRect(w / 2 - 4, 60, 8, h - 60);

    // 판
    const g = ctx.createLinearGradient(0, 14, 0, 78);
    g.addColorStop(0, '#5b56b0');
    g.addColorStop(1, '#2c2966');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(220,210,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(14, 14, w - 28, 64, 10);
    ctx.fill();
    ctx.stroke();

    // 별 무늬
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    for (let i = 0; i < 10; i++)
    {
        const r = i % 2 === 0 ? 13 : 5.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(w / 2 + Math.cos(a) * r, 46 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
}
