export type Ctx = CanvasRenderingContext2D;

// 매번 같은 숲이 나오도록 시드 고정 난수
export function seeded (seed: number)
{
    return () =>
    {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 시작은 굵고 끝은 가늘어지는 곡선 (가지)
export function taperedCurve (ctx: Ctx, p: number[], w0: number, w1: number)
{
    const [ x0, y0, c1x, c1y, c2x, c2y, x1, y1 ] = p;
    const at = (t: number, a: number, b: number, c: number, d: number) =>
    {
        const u = 1 - t;
        return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    };

    ctx.lineCap = 'round';
    const steps = 24;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= steps; i++)
    {
        const t = i / steps;
        const x = at(t, x0, c1x, c2x, x1);
        const y = at(t, y0, c1y, c2y, y1);
        ctx.lineWidth = w0 + (w1 - w0) * t;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        px = x;
        py = y;
    }
}

export function radialGlow (ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number)
{
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
