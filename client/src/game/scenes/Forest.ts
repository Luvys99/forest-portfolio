import { BlendModes, Cameras, GameObjects, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { Player } from '../objects/Player';
import {
    ABOUT_SPOT, BIG_TREE_H, BIG_TREE_W, CANOPY_Y, GROUND_Y, LADDERS, PLATFORMS, PORTALS, PROJECT_SPOTS,
    SpotDef, TREE_X, VIEW_H, VIEW_W, WORLD_H, WORLD_W
} from '../world/layout';
import { seeded } from '../world/draw-utils';
import {
    drawFog, drawGlow, drawGround, drawPlant, drawRay, drawSky, drawTreeLayer, drawVignette, drawVine, TreeLayerOptions
} from '../world/background-textures';
import { drawBigTree, drawBranchPlatform, drawLadder, drawOrb, drawPortal, LADDER_W, PLATFORM_TOP } from '../world/tree-textures';
import { Project, PROJECTS_KEY } from '../data/projects';
import { About, ABOUT_KEY } from '../data/about';
import { makeTexture } from '../world/textures';
import { Interactions } from '../world/interactions';
import { addOneWayPlatform, addPlatformCollider } from '../world/platforms';
import { addPortal } from '../world/portal';
import { fadeToScene } from '../world/scene-transition';
import { ModalLock } from '../world/modal-lock';
import { createSkyPortalTextures } from '../world/sky-textures';
import { formatTime, loadBest } from '../world/sky-record';

// 엘로딘 느낌의 숲
// 이미지 에셋 없이 캔버스로 텍스처를 그려서 레이어(패럴랙스) + 빛 + 파티클로 분위기를 낸다.

const MAX_SCROLL_Y = WORLD_H - VIEW_H;

type Ctx = CanvasRenderingContext2D;

// 어디에서 시작하나 (처음 들어올 때는 땅, 점프맵에서 돌아올 때는 나무 꼭대기의 점프맵 포탈 앞)
export interface ForestData
{
    from?: 'sky';
}

export class Forest extends Scene
{
    private parallax: { sprite: GameObjects.TileSprite; factor: number; texH: number }[] = [];
    private fogs: { sprite: GameObjects.TileSprite; factor: number; drift: number }[] = [];
    private interactions: Interactions;
    private player!: Player;
    private teleporting = false;
    private modal!: ModalLock;
    private from: ForestData['from'];

    constructor ()
    {
        super('Forest');
    }

    // 씬은 다시 시작해도 같은 객체를 쓰므로, 이전 판의 상태를 여기서 비운다
    init (data: ForestData)
    {
        this.from = data.from;
        this.parallax = [];
        this.fogs = [];
        this.interactions = new Interactions(this);
        this.teleporting = false;
    }

    preload ()
    {
        // 점프맵에서 돌아올 때는 이미 불러온 데이터를 그대로 쓴다
        if (!this.cache.json.exists(PROJECTS_KEY))
        {
            this.load.json(PROJECTS_KEY, 'projects.json');
        }
        if (!this.cache.json.exists(ABOUT_KEY))
        {
            this.load.json(ABOUT_KEY, 'about.json');
        }
    }

    create ()
    {
        this.createTextures();

        const cam = this.cameras.main;
        cam.setBounds(0, 0, WORLD_W, WORLD_H);
        this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

        // 1. 하늘 (고정)
        this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(0);

        // 2. 위에서 내려오는 빛줄기
        [ 260, 560, 900, 1150 ].forEach((x, i) =>
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
        this.addFog(0.2, 6, 3, 0.55, 300);
        this.addParallax('trees-mid', 0.35, 4);
        this.addParallax('trees-near', 0.6, 5);
        this.addFog(0.7, -10, 6, 0.4, 430);

        // 4. 큰 황금 나무 + 발판 + 사다리 + 포탈
        this.createBigTree();
        const platformZones = this.createPlatforms();
        this.createLadders();
        this.createPortals();

        // 5. 땅 + 빛나는 식물
        this.add.image(0, GROUND_Y - 40, 'ground').setOrigin(0).setDepth(20);
        this.createGlowPlants();

        // 6. 프로젝트 구슬과 소개
        this.createProjectSpots();
        this.createAboutSpot();

        // 7. 반딧불, 떨어지는 황금 꽃잎
        this.createParticles();

        // 8. 플레이어 + 충돌 + 카메라
        const ground = this.add.zone(WORLD_W / 2, GROUND_Y + 50, WORLD_W, 100);
        this.physics.add.existing(ground, true);

        const start = this.from === 'sky' ? PORTALS.sky : { x: TREE_X - 900, y: GROUND_Y };
        this.player = new Player(this, start.x, start.y - 40);
        this.player.ladders = LADDERS;
        this.physics.add.collider(this.player.hitbox, ground);
        addPlatformCollider(this, this.player, platformZones);

        this.modal = new ModalLock(this, this.player);

        cam.startFollow(this.player.hitbox, true, 0.08, 0.08);
        cam.setDeadzone(160, 160);
        if (this.from === 'sky')
        {
            cam.centerOn(start.x, start.y - 120);
            cam.fadeIn(320, 5, 18, 28);
        }

        // 9. 비네팅 + 조작 안내
        this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(50);
        // Mac은 Alt 대신 Option이라고 적힌 키를 쓴다
        const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        const altName = isMac ? 'Option' : 'Alt';
        this.add.text(24, 20, `← → 이동  ·  Space / ${altName} 점프  ·  ↑ ↓ 사다리  ·  ↓ + 점프 내려가기  ·  ↑ 보기 / 포탈`, {
            fontFamily: 'sans-serif', fontSize: '15px', color: '#cfeee6'
        }).setScrollFactor(0).setAlpha(0.7).setDepth(60);

        EventBus.emit('current-scene-ready', this);
    }

    update (time: number)
    {
        this.player.update(time);
        this.interactions.update(this.player, !this.teleporting && !this.modal.isOpen);

        const cam = this.cameras.main;

        // 세로로도 움직이므로 위아래 패럴랙스도 맞춘다
        for (const layer of this.parallax)
        {
            layer.sprite.tilePositionX = cam.scrollX * layer.factor;
            layer.sprite.tilePositionY = layer.texH - VIEW_H - (MAX_SCROLL_Y - cam.scrollY) * layer.factor;
        }

        for (const fog of this.fogs)
        {
            fog.sprite.tilePositionX = cam.scrollX * fog.factor + (this.time.now / 1000) * fog.drift;
        }
    }

    private addParallax (key: string, factor: number, depth: number)
    {
        const sprite = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, key)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(depth);

        this.parallax.push({ sprite, factor, texH: this.textures.get(key).getSourceImage().height });
    }

    private addFog (factor: number, drift: number, depth: number, alpha: number, y: number)
    {
        const sprite = this.add.tileSprite(0, y, VIEW_W, 260, 'fog')
            .setOrigin(0)
            .setScrollFactor(0)
            .setAlpha(alpha)
            .setDepth(depth);

        this.fogs.push({ sprite, factor, drift });
    }

    // ---------------------------------------------------------------- 큰 나무

    private createBigTree ()
    {
        // 잎 뒤의 따뜻한 빛
        const backGlow = this.add.image(TREE_X, CANOPY_Y + 250, 'glow-warm')
            .setScale(5.5, 3.2)
            .setBlendMode(BlendModes.ADD)
            .setAlpha(0.5)
            .setDepth(9);

        this.tweens.add({
            targets: backGlow,
            alpha: { from: 0.38, to: 0.6 },
            duration: 2600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.image(TREE_X, GROUND_Y + 6, 'big-tree')
            .setOrigin(0.5, 1)
            .setDepth(10);

        // 잎 아래로 늘어진 빛나는 덩굴 (사다리와 겹치지 않는 위치)
        [ -930, -560, -300, -150, 180, 340, 560, 930 ].forEach((dx, i) =>
        {
            const vine = this.add.image(TREE_X + dx, CANOPY_Y + 500, 'vine')
                .setOrigin(0.5, 0)
                .setScale(0.8 + (i % 3) * 0.1)
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
    }

    private createPlatforms ()
    {
        const zones: GameObjects.Zone[] = [];

        for (const p of PLATFORMS)
        {
            const w = p.x2 - p.x1;

            if (p.side !== 'top')
            {
                const key = `branch-${w}`;
                this.makeTexture(key, w, 70, ctx => drawBranchPlatform(ctx, w));
                this.add.image(p.x1, p.y - PLATFORM_TOP, key)
                    .setOrigin(0)
                    .setFlipX(p.side === 'right')
                    .setDepth(15);
            }

            zones.push(addOneWayPlatform(this, p.x1, p.x2, p.y));
        }

        return zones;
    }

    private createLadders ()
    {
        for (const l of LADDERS)
        {
            const h = l.bottom - l.top + 14;
            const key = `ladder-${h}`;
            this.makeTexture(key, LADDER_W, h, ctx => drawLadder(ctx, h));
            this.add.image(l.x, l.top - 10, key).setOrigin(0.5, 0).setDepth(16);
        }
    }

    private createPortals ()
    {
        const portals = [
            { from: PORTALS.bottom, to: PORTALS.top, label: '↑  나무 꼭대기로' },
            { from: PORTALS.top, to: PORTALS.bottom, label: '↑  아래로 내려가기' }
        ];

        portals.forEach(({ from, to, label }, i) =>
        {
            const promptY = addPortal(this, from.x, from.y, { seed: i });
            this.interactions.add(from.x, from.y, label, promptY, () => this.teleport(to.x, to.y));
        });

        // 나무 꼭대기 → 밤하늘 점프맵 (보랏빛으로 다른 맵이라는 걸 보여 준다)
        const { x, y } = PORTALS.sky;
        addPortal(this, x, y, { texture: 'portal-sky', glow: 'glow-sky', particleTints: [ 0xe6dcff, 0x9fd8ff ], seed: 2 });

        // 포탈 위 안내 (항상 보인다). 내 최고 기록이 있으면 같이 보여 준다
        const best = loadBest();
        this.add.text(x, y - 250, '밤하늘 점프맵', {
            fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ece6ff',
            stroke: '#0b0a2a', strokeThickness: 5
        }).setOrigin(0.5).setDepth(30);
        this.add.text(x, y - 226, best ? `내 최고 기록  ${formatTime(best)}` : '구름을 밟고 달까지', {
            fontFamily: 'sans-serif', fontSize: '14px', color: '#cfd8ff',
            stroke: '#0b0a2a', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);

        this.interactions.add(x, y, '↑  들어가기', y - 285, () =>
        {
            this.teleporting = true;
            this.player.locked = true;
            fadeToScene(this, 'Sky');
        });
    }

    // 화면을 어둡게 했다가 다른 포탈 위치에서 다시 밝힌다
    private teleport (x: number, feetY: number)
    {
        if (this.teleporting)
        {
            return;
        }

        this.teleporting = true;
        this.player.locked = true;

        const cam = this.cameras.main;
        cam.fadeOut(220, 5, 18, 28);
        cam.once(Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        {
            this.player.teleport(x, feetY);
            cam.centerOn(x, feetY - 120);
            cam.fadeIn(320, 5, 18, 28);
            this.player.locked = false;
            this.teleporting = false;
        });
    }

    // projects.json의 내용을 같은 id의 구슬 위치에 놓는다
    private createProjectSpots ()
    {
        const projects: Project[] = this.cache.json.get(PROJECTS_KEY) ?? [];

        PROJECT_SPOTS.forEach(spot =>
        {
            const project = projects.find(p => p.id === spot.id);
            if (!project)
            {
                console.warn(`projects.json에 '${spot.id}' 프로젝트가 없습니다`);
                return;
            }

            // React(App.tsx)가 이 이벤트를 받아 상세 팝업을 띄운다
            this.createSpot(spot, project.title, project.subtitle, 0xffd34d, () =>
            {
                this.modal.open('open-project', project);
            });
        });
    }

    private createAboutSpot ()
    {
        const about: About | undefined = this.cache.json.get(ABOUT_KEY);
        if (!about)
        {
            console.warn('about.json을 불러오지 못했습니다');
            return;
        }

        this.createSpot(ABOUT_SPOT, '소개', 'GitHub · 블로그 · 연락처', 0x8dffe0, () =>
        {
            this.modal.open('open-about', about);
        });
    }

    // 구슬 (이름은 항상 보이고, 가까이 가면 "↑ 자세히 보기")
    private createSpot (spot: SpotDef, title: string, subtitle: string, tint: number, open: () => void)
    {
        const orbY = spot.y - 70;

        this.add.image(spot.x, orbY, 'glow-warm')
            .setTint(tint)
            .setScale(0.5)
            .setBlendMode(BlendModes.ADD)
            .setAlpha(0.6)
            .setDepth(17);

        const orb = this.add.image(spot.x, orbY, 'orb')
            .setTint(tint)
            .setBlendMode(BlendModes.ADD)
            .setDepth(18);

        this.tweens.add({
            targets: orb,
            y: orbY - 8,
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.text(spot.x, orbY - 62, title, {
            fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff6d6',
            stroke: '#06141e', strokeThickness: 5
        }).setOrigin(0.5).setDepth(30);

        this.add.text(spot.x, orbY - 38, subtitle, {
            fontFamily: 'sans-serif', fontSize: '14px', color: '#cfeee6',
            stroke: '#06141e', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);

        this.interactions.add(spot.x, spot.y, '↑  자세히 보기', orbY - 92, () =>
        {
            open();
            this.tweens.add({ targets: orb, scale: { from: 1.5, to: 1 }, duration: 400, ease: 'Back.easeOut' });
        });
    }

    private createGlowPlants ()
    {
        const rand = seeded(7);
        let x = 40;

        while (x < WORLD_W)
        {
            // 나무 밑동과 사다리 아래는 비워 둔다
            const nearTrunk = Math.abs(x - TREE_X) < 260;
            const nearLadder = LADDERS.some(l => l.bottom === GROUND_Y && Math.abs(x - l.x) < 50);

            if (!nearTrunk && !nearLadder)
            {
                const scale = 0.6 + rand() * 0.7;
                const y = GROUND_Y + 4 + rand() * 10;

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
            y: { min: 150, max: GROUND_Y - 10 },
            tint: [ 0xb6ff8a, 0x7dffe4, 0xfff3a0 ],
            scale: { start: 0.35, end: 0.05 },
            alpha: { start: 0.9, end: 0 },
            speedX: { min: -12, max: 12 },
            speedY: { min: -18, max: 6 },
            lifespan: { min: 3000, max: 7000 },
            frequency: 25,
            blendMode: 'ADD'
        }).setDepth(25);

        // 황금 나무에서 떨어지는 꽃잎
        this.add.particles(0, 0, 'glow-dot', {
            x: { min: TREE_X - 950, max: TREE_X + 950 },
            y: { min: CANOPY_Y - 60, max: CANOPY_Y + 450 },
            tint: [ 0xffd34d, 0xffb84a ],
            scale: { start: 0.24, end: 0.1 },
            alpha: { start: 1, end: 0 },
            speedX: { min: -14, max: 14 },
            speedY: { min: 10, max: 30 },
            gravityY: 6,
            lifespan: 8000,
            frequency: 70,
            blendMode: 'ADD'
        }).setDepth(13);
    }

    // ---------------------------------------------------------------- 텍스처

    private createTextures ()
    {
        this.makeTexture('sky', VIEW_W, VIEW_H, drawSky);
        this.makeTexture('ray', 240, 900, drawRay);
        this.makeTexture('fog', VIEW_W, 260, drawFog);
        this.makeTexture('glow-dot', 64, 64, ctx => drawGlow(ctx, 32, 'rgba(255,255,255,1)'));
        this.makeTexture('glow-warm', 512, 512, ctx => drawGlow(ctx, 256, 'rgba(255,200,80,0.6)'));
        this.makeTexture('vignette', VIEW_W, VIEW_H, drawVignette);
        this.makeTexture('vine', 24, 220, drawVine);
        this.makeTexture('plant', 40, 70, drawPlant);
        this.makeTexture('ground', WORLD_W, 160, drawGround);
        this.makeTexture('big-tree', BIG_TREE_W, BIG_TREE_H, drawBigTree);
        this.makeTexture('portal', 160, 220, drawPortal);
        this.makeTexture('orb', 64, 64, drawOrb);
        createSkyPortalTextures(this);

        this.makeTreeLayer('trees-far', 0.15, { color: '#134a5e', count: 9, minW: 16, maxW: 30, seed: 1 });
        this.makeTreeLayer('trees-mid', 0.35, { color: '#0b3044', count: 6, minW: 28, maxW: 50, seed: 2 });
        this.makeTreeLayer('trees-near', 0.6, { color: '#071d2b', count: 3, minW: 40, maxW: 65, seed: 3 });
    }

    // 세로 패럴랙스 범위만큼 텍스처를 길게 만들어서 위아래로 반복되지 않게 한다
    private makeTreeLayer (key: string, factor: number, opt: TreeLayerOptions)
    {
        const h = Math.ceil(VIEW_H + MAX_SCROLL_Y * factor);
        this.makeTexture(key, VIEW_W, h, ctx => drawTreeLayer(ctx, opt));
    }

    private makeTexture (key: string, w: number, h: number, draw: (ctx: Ctx) => void)
    {
        makeTexture(this, key, w, h, draw);
    }
}
