import { VIEW_H, VIEW_W } from './layout';
import { Ctx, radialGlow, seeded } from './draw-utils';
import { CLOUD_LINE, CLOUD_TEXTURE_H, cloudShape } from './cloud-shape';
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
// 만화풍 뭉게구름: 덩어리들을 하나로 칠하고 바깥 윤곽에만 선을 두른 뒤, 앞줄 덩어리 위에 짧은 주름 선을 긋는다
export function drawCloudPlatform (ctx: Ctx, w: number)
{
    const { lobes } = cloudShape(w);
    const h = CLOUD_TEXTURE_H;
    const ink = '78,80,128';

    // 아래쪽 은은한 빛. 텍스처 밖으로 넘치면 가장자리에서 잘려 네모난 테두리가 보이므로 납작한 타원으로 안에 넣는다
    const glowY = h - 14;
    const glowR = w / 2;
    ctx.save();
    ctx.translate(w / 2, glowY);
    ctx.scale(1, (h - glowY) / glowR);
    radialGlow(ctx, 0, 0, glowR, '150,140,255', 0.2);
    ctx.restore();

    const body = () =>
    {
        ctx.beginPath();
        for (const { x, y, r } of lobes)
        {
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
        }
    };

    // 1. 바깥 윤곽: 굵게 그은 선 위를 몸통으로 덮으면 바깥쪽 절반만 남는다
    body();
    ctx.lineWidth = CLOUD_LINE * 2;
    ctx.strokeStyle = `rgba(${ink},0.9)`;
    ctx.stroke();

    // 2. 몸통: 완전한 흰색이 아닌 따뜻한 미색, 아래로 갈수록 푸르스름한 회색
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, 'rgb(252,250,244)');
    fill.addColorStop(0.55, 'rgb(240,239,243)');
    fill.addColorStop(1, 'rgb(203,206,228)');
    ctx.fillStyle = fill;
    body();
    ctx.fill();

    ctx.save();
    body();
    ctx.clip();

    // 3. 덩어리마다 오른쪽 아래 그늘, 왼쪽 위 빛 (몸통 안에서만)
    for (const { x, y, r } of lobes)
    {
        radialGlow(ctx, x + r * 0.35, y + r * 0.45, r * 0.8, '170,175,215', 0.28);
        radialGlow(ctx, x - r * 0.3, y - r * 0.4, r * 0.55, '255,255,255', 0.55);
    }

    // 4. 앞줄 덩어리의 윗둘레 주름 선과 오른쪽 아래 빗금 (참고 그림의 명암 선)
    // 모두 같은 모양이면 무늬처럼 반복돼 보이므로 덩어리마다 위치와 길이를 조금씩 바꾸고, 몇 개는 건너뛴다
    const rand = seeded(w + 1);
    ctx.lineCap = 'round';
    for (const { x, y, r, front } of lobes)
    {
        if (!front || rand() < 0.3)
        {
            continue;
        }
        const start = (1.05 + rand() * 0.2) * Math.PI;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${ink},0.5)`;
        ctx.beginPath();
        ctx.arc(x, y, r, start, start + (0.3 + rand() * 0.25) * Math.PI);
        ctx.stroke();

        ctx.lineWidth = 1.1;
        ctx.strokeStyle = `rgba(${ink},0.3)`;
        for (const k of [ 0.6, 0.78 ])
        {
            ctx.beginPath();
            ctx.arc(x, y, r * k, 0.1 * Math.PI, 0.35 * Math.PI);
            ctx.stroke();
        }
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
