import { BlendModes, GameObjects, Scene } from 'phaser';
import { Pose } from './spirit-pose';

// 정령 그림 (몸 + 글로우). 내 캐릭터(Player)와 다른 방문자(RemotePlayer)가 같이 쓴다

// 텍스처 64x64 중 발이 y=58 에 있다
const ORIGIN_Y = 58 / 64;
const SPRITE_SCALE = 1.1;
const GLOW_ABOVE_FEET = 28;
const GLOW_SCALE = 2.4;
const GLOW_ALPHA = 0.45;

export interface SpiritImages
{
    sprite: GameObjects.Image;
    glow: GameObjects.Image;
}

export interface SpiritStyle
{
    glowColor: number;
    glowDepth: number;
    spriteDepth: number;
}

// (x, footY) 는 발 위치
export function addSpirit (scene: Scene, x: number, footY: number, style: SpiritStyle): SpiritImages
{
    ensureSpiritTexture(scene);

    const glow = scene.add.image(x, footY - GLOW_ABOVE_FEET, 'glow-dot')
        .setTint(style.glowColor)
        .setScale(GLOW_SCALE)
        .setBlendMode(BlendModes.ADD)
        .setAlpha(GLOW_ALPHA)
        .setDepth(style.glowDepth);

    const sprite = scene.add.image(x, footY, 'spirit')
        .setOrigin(0.5, ORIGIN_Y)
        .setDepth(style.spriteDepth);

    return { sprite, glow };
}

export function applySpiritPose (images: SpiritImages, x: number, footY: number, facing: number, pose: Pose)
{
    images.sprite
        .setPosition(x, footY + pose.offsetY)
        .setScale(pose.sx * SPRITE_SCALE, pose.sy * SPRITE_SCALE)
        .setRotation(pose.rotation)
        .setFlipX(facing < 0);

    images.glow.setPosition(x, footY - GLOW_ABOVE_FEET + pose.offsetY);
}

// 숲의 정령 텍스처 (캔버스로 그린다)
function ensureSpiritTexture (scene: Scene)
{
    if (scene.textures.exists('spirit'))
    {
        return;
    }

    const texture = scene.textures.createCanvas('spirit', 64, 64);
    if (!texture)
    {
        return;
    }

    const ctx = texture.getContext();

    // 몸통
    const body = ctx.createRadialGradient(28, 30, 2, 32, 38, 26);
    body.addColorStop(0, '#f6fffc');
    body.addColorStop(0.55, '#b4f3e2');
    body.addColorStop(1, '#5ccdb3');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(10, 50);
    ctx.bezierCurveTo(8, 30, 18, 16, 32, 16);
    ctx.bezierCurveTo(46, 16, 56, 30, 54, 50);
    ctx.quadraticCurveTo(54, 58, 44, 58);
    ctx.lineTo(20, 58);
    ctx.quadraticCurveTo(10, 58, 10, 50);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(40,130,115,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 머리 위 새싹
    ctx.strokeStyle = '#4fae6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 17);
    ctx.quadraticCurveTo(31, 11, 34, 7);
    ctx.stroke();

    ctx.fillStyle = '#86e48f';
    ctx.beginPath();
    ctx.ellipse(39, 7, 6, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(28, 9, 5, 2.5, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (오른쪽을 보는 방향, 왼쪽으로 가면 좌우 반전)
    ctx.fillStyle = '#0f2a33';
    for (const ex of [ 35, 46 ])
    {
        ctx.beginPath();
        ctx.ellipse(ex, 36, 3, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (const ex of [ 36, 47 ])
    {
        ctx.beginPath();
        ctx.arc(ex, 34.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // 볼터치
    ctx.fillStyle = 'rgba(255,140,155,0.5)';
    for (const bx of [ 30, 51 ])
    {
        ctx.beginPath();
        ctx.ellipse(bx, 44, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    texture.refresh();
}
