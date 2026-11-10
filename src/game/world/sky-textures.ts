import { VIEW_H, VIEW_W } from './layout';
import { Ctx, radialGlow, seeded } from './draw-utils';
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

export const CLOUD_TOP = 14;

// 밟는 구름 발판 (위쪽 CLOUD_TOP 위치가 밟는 면)
export function drawCloudPlatform (ctx: Ctx, w: number)
{
    const rand = seeded(w);
    const h = 56;

    // 아래쪽 은은한 빛
    radialGlow(ctx, w / 2, h * 0.7, w * 0.55, '150,140,255', 0.18);

    const g = ctx.createLinearGradient(0, CLOUD_TOP - 8, 0, h - 6);
    g.addColorStop(0, 'rgba(250,248,255,0.97)');
    g.addColorStop(0.6, 'rgba(205,200,250,0.92)');
    g.addColorStop(1, 'rgba(140,140,220,0.85)');
    ctx.fillStyle = g;

    // 몸통 + 위쪽 몽실몽실한 혹
    ctx.beginPath();
    ctx.ellipse(w / 2, CLOUD_TOP + 16, w / 2 - 6, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const bumps = Math.max(3, Math.round(w / 45));
    for (let i = 0; i < bumps; i++)
    {
        const t = (i + 0.5) / bumps;
        const x = 14 + t * (w - 28);
        const r = 10 + rand() * 9;
        ctx.beginPath();
        ctx.arc(x, CLOUD_TOP + 12 - r * 0.25, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 윗면 하이라이트
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(w / 2, CLOUD_TOP + 10, w / 2 - 20, 5, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
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
