import { BlendModes, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { Player } from '../objects/Player';

// 엘로딘 느낌의 숲
// 이미지 에셋 없이 캔버스로 텍스처를 그려서 레이어(패럴랙스) + 빛 + 파티클로 분위기를 낸다.

const VIEW_W = 1280;
const VIEW_H = 720;
const WORLD_W = 3840;
const GROUND_TOP = 600;
const TREE_X = 1920;
const TREE_SCALE = 0.75;
const INTERACT_RANGE = 140;   // 황금 나무에서 이 거리 안이면 상호작용 가능

type Ctx = CanvasRenderingContext2D;

// 매번 같은 숲이 나오도록 시드 고정 난수
function seeded (seed: number)
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

interface TreeLayerOptions
{
    color: string;
    count: number;
    minW: number;
    maxW: number;
    seed: number;
    branches?: number;
    xs?: number[];
}

// 시작은 굵고 끝은 가늘어지는 곡선 (가지)
function taperedCurve (ctx: CanvasRenderingContext2D, p: number[], w0: number, w1: number)
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

export class Forest extends Scene
{
    private parallax: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];
    private fogs: { sprite: Phaser.GameObjects.TileSprite; factor: number; drift: number }[] = [];
    private player!: Player;
    private treeLabel!: Phaser.GameObjects.Text;
    private treeGlow!: Phaser.GameObjects.Image;

    constructor ()
    {
        super('Forest');
    }

    create ()
    {
        this.createTextures();

        const cam = this.cameras.main;
        cam.setBounds(0, 0, WORLD_W, VIEW_H);
        this.physics.world.setBounds(0, 0, WORLD_W, VIEW_H);

        // 1. 하늘 (고정)
        this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(0);

        // 2. 위에서 내려오는 빛줄기
        [260, 560, 900, 1150].forEach((x, i) =>
        {
            const ray = this.add.image(x, -40, 'ray')
                .setOrigin(0.5, 0)
                .setAngle(16)
                .setScrollFactor(0.25)
                .setBlendMode(BlendModes.ADD)
                .setAlpha(0.25)
                .setDepth(1);

            this.tweens.add({
                targets: ray,
                alpha: { from: 0.12, to: 0.4 },
                duration: 3000 + i * 700,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        // 3. 나무 실루엣 레이어 (멀수록 천천히, 흐리게)
        this.addParallax('trees-far', 0.15, 2);
        this.addFog('fog', 0.2, 6, 3, 0.55, 300);
        this.addParallax('trees-mid', 0.35, 4);
        this.addParallax('trees-near', 0.6, 5);
        this.addFog('fog', 0.7, -10, 6, 0.4, 430);

        // 4. 황금 나무 (프로젝트 나무)
        this.createGoldenTree();

        // 5. 땅 + 빛나는 식물
        this.add.image(0, GROUND_TOP - 40, 'ground').setOrigin(0).setDepth(20);
        this.createGlowPlants();

        // 6. 반딧불, 떨어지는 황금 꽃잎
        this.createParticles();

        // 7. 땅 판정 + 플레이어 + 카메라
        const ground = this.add.zone(WORLD_W / 2, GROUND_TOP + 50, WORLD_W, 100);
        this.physics.add.existing(ground, true);

        this.player = new Player(this, TREE_X - 520, GROUND_TOP - 40);
        this.physics.add.collider(this.player.hitbox, ground);

        cam.startFollow(this.player.hitbox, true, 0.08, 0.08);
        cam.setDeadzone(160, 200);

        // 8. 가장 앞쪽 나무 (화면보다 빠르게 움직여 깊이감)
        this.addParallax('trees-front', 1.3, 40);

        // 9. 비네팅 + 조작 안내
        this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(50);
        this.add.text(24, 20, '← → 이동  ·  Space / Alt 점프  ·  ↑ 프로젝트 보기', {
            fontFamily: 'sans-serif', fontSize: '16px', color: '#cfeee6'
        }).setScrollFactor(0).setAlpha(0.7).setDepth(60);

        EventBus.emit('current-scene-ready', this);
    }

    update (time: number)
    {
        this.player.update(time);
        this.updateTreeInteraction();

        const cam = this.cameras.main;

        for (const layer of this.parallax)
        {
            layer.sprite.tilePositionX = cam.scrollX * layer.factor;
        }

        for (const fog of this.fogs)
        {
            fog.sprite.tilePositionX = cam.scrollX * fog.factor + (this.time.now / 1000) * fog.drift;
        }
    }

    // 황금 나무 근처에서만 안내를 보여 주고, ↑ 키로 프로젝트 열기 이벤트를 보낸다
    private updateTreeInteraction ()
    {
        const near = Math.abs(this.player.x - TREE_X) < INTERACT_RANGE && this.player.onGround;
        const target = near ? 1 : 0;
        this.treeLabel.setAlpha(this.treeLabel.alpha + (target - this.treeLabel.alpha) * 0.15);

        if (near && this.player.justPressedUp())
        {
            // React 쪽에서 이 이벤트를 받아 프로젝트 상세 팝업을 띄울 예정
            EventBus.emit('open-project', 'golden-tree');

            this.tweens.add({
                targets: this.treeGlow,
                alpha: { from: 1, to: 0.22 },
                duration: 600,
                ease: 'Quad.easeOut'
            });
        }
    }

    private addParallax (key: string, factor: number, depth: number)
    {
        const sprite = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, key)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(depth);

        this.parallax.push({ sprite, factor });
    }

    private addFog (key: string, factor: number, drift: number, depth: number, alpha: number, y: number)
    {
        const sprite = this.add.tileSprite(0, y, VIEW_W, 260, key)
            .setOrigin(0)
            .setScrollFactor(0)
            .setAlpha(alpha)
            .setDepth(depth);

        this.fogs.push({ sprite, factor, drift });
    }

    private createGoldenTree ()
    {
        // 나무 뒤의 따뜻한 빛
        const backGlow = this.add.image(TREE_X, 300, 'glow-warm')
            .setScale(2.4)
            .setBlendMode(BlendModes.ADD)
            .setAlpha(0.55)
            .setDepth(9);

        this.tweens.add({
            targets: backGlow,
            alpha: { from: 0.4, to: 0.65 },
            scale: { from: 2.3, to: 2.55 },
            duration: 2600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.image(TREE_X, GROUND_TOP + 6, 'golden-tree')
            .setOrigin(0.5, 1)
            .setScale(TREE_SCALE)
            .setDepth(10);

        // 잎 위에 한 번 더 빛을 얹어서 번지는 느낌
        this.treeGlow = this.add.image(TREE_X, 230, 'glow-warm')
            .setScale(1.6)
            .setBlendMode(BlendModes.ADD)
            .setAlpha(0.22)
            .setDepth(11);

        // 가지에 매달린 빛나는 덩굴 (흔들림)
        const toWorld = (tx: number, ty: number) => ({
            x: TREE_X + (tx - 500) * TREE_SCALE,
            y: GROUND_TOP + 6 - (760 - ty) * TREE_SCALE
        });

        const vines: [number, number][] = [ [ 170, 360 ], [ 290, 390 ], [ 430, 300 ], [ 600, 360 ], [ 720, 320 ], [ 850, 390 ] ];

        vines.forEach(([ tx, ty ], i) =>
        {
            const p = toWorld(tx, ty);
            const vine = this.add.image(p.x, p.y, 'vine')
                .setOrigin(0.5, 0)
                .setScale(0.8 + (i % 3) * 0.15)
                .setBlendMode(BlendModes.ADD)
                .setDepth(12);

            this.tweens.add({
                targets: vine,
                angle: { from: -4, to: 4 },
                duration: 2200 + i * 300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });

        // 프로젝트 나무 안내
        this.treeLabel = this.add.text(TREE_X, GROUND_TOP - 110, '↑  프로젝트 보기', {
            fontFamily: 'sans-serif', fontSize: '18px', color: '#fff4c4',
            backgroundColor: 'rgba(10, 30, 40, 0.55)', padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setDepth(30).setAlpha(0);

        this.tweens.add({
            targets: this.treeLabel,
            y: GROUND_TOP - 118,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private createGlowPlants ()
    {
        const rand = seeded(7);
        let x = 40;

        while (x < WORLD_W)
        {
            // 황금 나무 바로 앞은 비워 둔다
            if (Math.abs(x - TREE_X) > 120)
            {
                const scale = 0.6 + rand() * 0.7;
                const y = GROUND_TOP + 4 + rand() * 10;

                const glow = this.add.image(x, y - 34 * scale, 'glow-dot')
                    .setTint(rand() > 0.5 ? 0x6fffe0 : 0x9dff7a)
                    .setScale(scale * 1.6)
                    .setBlendMode(BlendModes.ADD)
                    .setAlpha(0.5)
                    .setDepth(21);

                this.add.image(x, y, 'plant').setOrigin(0.5, 1).setScale(scale).setDepth(22);

                this.tweens.add({
                    targets: glow,
                    alpha: { from: 0.25, to: 0.7 },
                    duration: 1500 + rand() * 2000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }

            x += 60 + rand() * 120;
        }
    }

    private createParticles ()
    {
        // 반딧불
        this.add.particles(0, 0, 'glow-dot', {
            x: { min: 0, max: WORLD_W },
            y: { min: 120, max: GROUND_TOP - 10 },
            tint: [ 0xb6ff8a, 0x7dffe4, 0xfff3a0 ],
            scale: { start: 0.35, end: 0.05 },
            alpha: { start: 0.9, end: 0 },
            speedX: { min: -12, max: 12 },
            speedY: { min: -18, max: 6 },
            lifespan: { min: 3000, max: 7000 },
            frequency: 60,
            blendMode: 'ADD'
        }).setDepth(25);

        // 황금 나무에서 떨어지는 꽃잎
        this.add.particles(0, 0, 'glow-dot', {
            x: { min: TREE_X - 280, max: TREE_X + 280 },
            y: { min: 130, max: 320 },
            tint: [ 0xffd34d, 0xffb84a ],
            scale: { start: 0.22, end: 0.1 },
            alpha: { start: 1, end: 0 },
            speedX: { min: -14, max: 14 },
            speedY: { min: 8, max: 26 },
            gravityY: 6,
            lifespan: 6000,
            frequency: 200,
            blendMode: 'ADD'
        }).setDepth(13);
    }

    // ---------------------------------------------------------------- 텍스처

    private createTextures ()
    {
        this.makeTexture('sky', VIEW_W, VIEW_H, ctx => this.drawSky(ctx));
        this.makeTexture('ray', 240, 900, ctx => this.drawRay(ctx));
        this.makeTexture('fog', VIEW_W, 260, ctx => this.drawFog(ctx));
        this.makeTexture('glow-dot', 64, 64, ctx => this.drawGlow(ctx, 32, 'rgba(255,255,255,1)'));
        this.makeTexture('glow-warm', 512, 512, ctx => this.drawGlow(ctx, 256, 'rgba(255,200,80,0.6)'));
        this.makeTexture('vignette', VIEW_W, VIEW_H, ctx => this.drawVignette(ctx));
        this.makeTexture('golden-tree', 1000, 760, ctx => this.drawGoldenTree(ctx));
        this.makeTexture('vine', 24, 220, ctx => this.drawVine(ctx));
        this.makeTexture('plant', 40, 70, ctx => this.drawPlant(ctx));
        this.makeTexture('ground', WORLD_W, 160, ctx => this.drawGround(ctx));

        this.makeTexture('trees-far', VIEW_W, VIEW_H, ctx => this.drawTreeLayer(ctx, { color: '#134a5e', count: 9, minW: 16, maxW: 30, seed: 1 }));
        this.makeTexture('trees-mid', VIEW_W, VIEW_H, ctx => this.drawTreeLayer(ctx, { color: '#0b3044', count: 6, minW: 28, maxW: 50, seed: 2 }));
        this.makeTexture('trees-near', VIEW_W, VIEW_H, ctx => this.drawTreeLayer(ctx, { color: '#071d2b', count: 3, minW: 40, maxW: 65, seed: 3 }));
        // 앞쪽 나무는 하나만, 처음 화면에서 황금 나무를 가리지 않는 위치에
        this.makeTexture('trees-front', VIEW_W, VIEW_H, ctx => this.drawTreeLayer(ctx, { color: '#02080e', count: 1, minW: 60, maxW: 75, seed: 4, branches: 1, xs: [ 520 ] }));
    }

    private makeTexture (key: string, w: number, h: number, draw: (ctx: Ctx) => void)
    {
        if (this.textures.exists(key))
        {
            return;
        }

        const texture = this.textures.createCanvas(key, w, h);
        if (!texture)
        {
            return;
        }

        draw(texture.getContext());
        texture.refresh();
    }

    private drawSky (ctx: Ctx)
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

    private drawRay (ctx: Ctx)
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

    private drawFog (ctx: Ctx)
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

    private drawGlow (ctx: Ctx, r: number, color: string)
    {
        const g = ctx.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, color);
        g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
        g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, r * 2, r * 2);
    }

    private drawVignette (ctx: Ctx)
    {
        const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.7);
        g.addColorStop(0, 'rgba(0,6,14,0)');
        g.addColorStop(1, 'rgba(0,6,14,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    private drawTreeLayer (ctx: Ctx, opt: TreeLayerOptions)
    {
        const rand = seeded(opt.seed);
        ctx.fillStyle = opt.color;
        ctx.strokeStyle = opt.color;
        ctx.lineCap = 'round';

        const count = opt.xs?.length ?? opt.count;

        for (let i = 0; i < count; i++)
        {
            const x = opt.xs ? opt.xs[i] : (i + rand() * 0.8) * (VIEW_W / count);
            const w = opt.minW + rand() * (opt.maxW - opt.minW);
            const lean = (rand() - 0.5) * w * 2;
            const branches = Array.from({ length: opt.branches ?? 2 }, () => ({
                t: 0.3 + rand() * 0.45,
                dir: rand() > 0.5 ? 1 : -1,
                len: w * (2.5 + rand() * 3),
                rise: w * (1.5 + rand() * 2.5)
            }));

            for (const ox of [ -VIEW_W, 0, VIEW_W ])
            {
                this.drawTrunk(ctx, x + ox, VIEW_H, -40, w, lean);

                for (const b of branches)
                {
                    const by = VIEW_H - (VIEW_H + 40) * b.t;
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

    private drawTrunk (ctx: Ctx, x: number, baseY: number, topY: number, w: number, lean: number)
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

    private drawGoldenTree (ctx: Ctx)
    {
        const rand = seeded(21);

        // 줄기와 가지 (남색, 끝으로 갈수록 가늘게)
        const bark = ctx.createLinearGradient(380, 0, 640, 0);
        bark.addColorStop(0, '#34609c');
        bark.addColorStop(0.45, '#1c3a6c');
        bark.addColorStop(1, '#0e2045');
        ctx.fillStyle = bark;
        ctx.strokeStyle = bark;

        // 뿌리
        ctx.beginPath();
        ctx.moveTo(380, 760);
        ctx.quadraticCurveTo(450, 720, 455, 640);
        ctx.lineTo(545, 640);
        ctx.quadraticCurveTo(555, 720, 630, 760);
        ctx.closePath();
        ctx.fill();
        taperedCurve(ctx, [ 480, 720, 430, 740, 370, 750, 300, 760 ], 34, 6);
        taperedCurve(ctx, [ 520, 720, 580, 740, 650, 750, 720, 760 ], 34, 6);

        // 비틀린 줄기와 큰 가지
        taperedCurve(ctx, [ 500, 760, 450, 640, 550, 540, 495, 430 ], 110, 70);
        taperedCurve(ctx, [ 495, 440, 420, 390, 330, 380, 215, 300 ], 66, 14);
        taperedCurve(ctx, [ 505, 440, 600, 400, 700, 350, 790, 250 ], 62, 14);
        taperedCurve(ctx, [ 497, 430, 530, 340, 470, 270, 520, 170 ], 48, 10);

        // 잔가지
        taperedCurve(ctx, [ 330, 378, 270, 400, 200, 385, 130, 345 ], 22, 4);
        taperedCurve(ctx, [ 700, 350, 780, 372, 830, 355, 885, 382 ], 20, 4);
        taperedCurve(ctx, [ 480, 300, 410, 250, 385, 200, 350, 150 ], 18, 4);
        taperedCurve(ctx, [ 515, 250, 620, 230, 660, 180, 700, 150 ], 18, 4);
        taperedCurve(ctx, [ 215, 300, 200, 250, 230, 210, 250, 170 ], 16, 4);

        // 줄기 왼쪽 하이라이트
        ctx.strokeStyle = 'rgba(130,180,240,0.3)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(462, 750);
        ctx.bezierCurveTo(422, 640, 512, 540, 468, 440);
        ctx.stroke();

        // 잎 덩어리: [중심x, 중심y, 가로 반지름, 세로 반지름]
        const clusters: [number, number, number, number][] = [
            [ 210, 250, 140, 90 ], [ 370, 170, 150, 95 ], [ 540, 135, 160, 95 ], [ 710, 180, 150, 95 ],
            [ 830, 280, 110, 75 ], [ 130, 340, 90, 55 ], [ 300, 335, 110, 65 ], [ 620, 295, 120, 70 ], [ 900, 370, 70, 45 ]
        ];

        // 잎 아래로 번지는 은은한 빛
        for (const [ cx, cy, rx, ry ] of clusters)
        {
            const r = Math.max(rx, ry) * 1.4;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, 'rgba(255,205,80,0.35)');
            g.addColorStop(1, 'rgba(255,205,80,0)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }

        // 위에서 빛을 받는 것처럼 위쪽은 밝게, 아래쪽은 진하게
        const palette = [ '#fff4b8', '#ffe46a', '#ffd23f', '#ffbe1e', '#ee9f10', '#c27a0b' ];
        const leaves: { x: number; y: number; size: number; rot: number; color: string }[] = [];

        for (const [ cx, cy, rx, ry ] of clusters)
        {
            const n = Math.round(rx * 3.2);
            for (let i = 0; i < n; i++)
            {
                const a = rand() * Math.PI * 2;
                const d = Math.sqrt(rand());
                const x = cx + Math.cos(a) * d * rx;
                const y = cy + Math.sin(a) * d * ry;
                const shade = (y - (cy - ry)) / (ry * 2);
                const idx = Math.min(5, Math.max(0, Math.floor((shade * 0.75 + rand() * 0.35) * 6)));
                leaves.push({ x, y, size: 6 + rand() * 9, rot: rand() * Math.PI, color: palette[idx] });
            }

            // 아래로 늘어진 잎
            for (let i = 0; i < rx * 0.25; i++)
            {
                const x = cx + (rand() * 2 - 1) * rx * 0.8;
                const y = cy + ry * (0.6 + rand() * 0.55);
                leaves.push({ x, y, size: 6 + rand() * 6, rot: Math.PI / 2 + (rand() - 0.5) * 0.6, color: palette[3 + Math.floor(rand() * 3)] });
            }
        }

        // 아래쪽 잎부터 그려서 위쪽 잎이 덮도록
        leaves.sort((a, b) => b.y - a.y);
        for (const l of leaves)
        {
            ctx.fillStyle = l.color;
            ctx.beginPath();
            ctx.ellipse(l.x, l.y, l.size, l.size * 0.55, l.rot, 0, Math.PI * 2);
            ctx.fill();
        }

        // 반짝임
        for (let i = 0; i < 60; i++)
        {
            const l = leaves[Math.floor(rand() * leaves.length)];
            ctx.fillStyle = 'rgba(255,255,235,0.9)';
            ctx.beginPath();
            ctx.arc(l.x, l.y - 2, 1.2 + rand() * 1.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 붉은 꽃
        for (let i = 0; i < 12; i++)
        {
            const [ cx, cy, rx, ry ] = clusters[Math.floor(rand() * clusters.length)];
            const a = rand() * Math.PI * 2;
            const fx = cx + Math.cos(a) * rx * 0.9;
            const fy = cy + Math.sin(a) * ry * 0.85;
            ctx.fillStyle = '#ff5e57';
            for (let p = 0; p < 5; p++)
            {
                const pa = (p / 5) * Math.PI * 2 + a;
                ctx.beginPath();
                ctx.ellipse(fx + Math.cos(pa) * 5, fy + Math.sin(pa) * 5, 5, 3, pa, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#ffd6a0';
            ctx.beginPath();
            ctx.arc(fx, fy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawVine (ctx: Ctx)
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

    private drawPlant (ctx: Ctx)
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

    private drawGround (ctx: Ctx)
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
}
