import { BlendModes, Scene } from 'phaser';

export interface PortalStyle
{
    // 포탈 텍스처와 뒤쪽 빛 (없으면 황금 포탈)
    texture?: string;
    glow?: string;
    particleTints?: number[];
    // 여러 포탈이 똑같이 숨 쉬지 않도록 박자를 조금씩 다르게
    seed?: number;
}

// 빛나는 포탈 그림 (판정은 Interactions로 따로 붙인다)
// (x, feetY)는 포탈 바닥 가운데. 안내 문구를 띄울 y를 돌려준다
export function addPortal (scene: Scene, x: number, feetY: number, style: PortalStyle = {})
{
    const { texture = 'portal', glow = 'glow-warm', particleTints = [ 0xfff3a0, 0xffd34d ], seed = 0 } = style;
    const cy = feetY - 105;

    scene.add.image(x, cy, glow)
        .setScale(0.9, 1.1)
        .setBlendMode(BlendModes.ADD)
        .setAlpha(0.45)
        .setDepth(17);

    const portal = scene.add.image(x, cy, texture)
        .setBlendMode(BlendModes.ADD)
        .setDepth(18);


    scene.tweens.add({
        targets: portal,
        scaleX: { from: 0.94, to: 1.04 },
        scaleY: { from: 1.02, to: 0.96 },
        alpha: { from: 0.8, to: 1 },
        duration: 1400 + seed * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // 포탈에서 올라가는 빛 알갱이
    scene.add.particles(0, 0, 'glow-dot', {
        x: { min: x - 45, max: x + 45 },
        y: { min: cy + 40, max: cy + 90 },
        tint: particleTints,
        scale: { start: 0.25, end: 0 },
        alpha: { start: 1, end: 0 },
        speedY: { min: -60, max: -30 },
        lifespan: 1600,
        frequency: 90,
        blendMode: 'ADD'
    }).setDepth(19);

    return cy - 135;
}
