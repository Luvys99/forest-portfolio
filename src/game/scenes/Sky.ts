import { BlendModes, GameObjects, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { Player } from '../objects/Player';
import { VIEW_H, VIEW_W } from '../world/layout';
import { CLOUDS, CloudDef, GOAL, SKY_GROUND_Y, SKY_H, SKY_PORTALS, SKY_START, SKY_W } from '../world/sky-layout';
import {
    CLOUD_TOP, createSkyPortalTextures, drawCloudBand, drawCloudPlatform, drawLeafFloor, drawMoon, drawNightSky, drawStars
} from '../world/sky-textures';
import { makeTexture } from '../world/textures';
import { Interactions } from '../world/interactions';
import { addOneWayPlatform, addPlatformCollider } from '../world/platforms';
import { addPortal } from '../world/portal';
import { fadeToScene } from '../world/scene-transition';

// 숲 위 밤하늘 점프맵
// 구름을 밟고 달까지 올라간다. 클리어 시간을 재고, 최고 기록은 브라우저에 저장한다 (서버 없음)

const BEST_KEY = 'forest-portfolio:sky-best';

// 브라우저 저장소는 사생활 보호 모드 등에서 막혀 있을 수 있어서 실패해도 게임은 계속된다
function loadBest (): number | null
{
    try
    {
        const value = Number(localStorage.getItem(BEST_KEY));
        return value > 0 ? value : null;
    }
    catch
    {
        return null;
    }
}

function saveBest (ms: number)
{
    try
    {
        localStorage.setItem(BEST_KEY, String(ms));
    }
    catch
    {
        // 저장이 안 돼도 이번 판 기록은 화면에 보여 준다
    }
}

// 83456 → "1:23.45"
function formatTime (ms: number)
{
    const total = ms / 1000;
    const min = Math.floor(total / 60);
    const sec = (total % 60).toFixed(2).padStart(5, '0');
    return `${min}:${sec}`;
}

export class Sky extends Scene
{
    private player!: Player;
    private interactions: Interactions;
    private layers: { sprite: GameObjects.TileSprite; factor: number }[] = [];
    private leaving = false;

    // 타이머: 처음 발을 떼는 순간 시작, 달에 닿으면 멈춘다
    private startedAt: number | null = null;
    private clearedMs: number | null = null;
    private timerText!: GameObjects.Text;

    constructor ()
    {
        super('Sky');
    }

    init ()
    {
        this.interactions = new Interactions(this);
        this.layers = [];
        this.leaving = false;
        this.startedAt = null;
        this.clearedMs = null;
    }

    create ()
    {
        this.createTextures();

        const cam = this.cameras.main;
        cam.setBounds(0, 0, SKY_W, SKY_H);
        this.physics.world.setBounds(0, 0, SKY_W, SKY_H);

        // 1. 하늘 + 별 + 구름 띠 (멀수록 천천히)
        this.add.image(0, 0, 'night-sky').setOrigin(0).setScrollFactor(0).setDepth(0);
        this.addLayer('stars-far', 0.08, 1);
        this.addLayer('stars-near', 0.2, 2);
        this.addLayer('cloud-band-far', 0.3, 3, 0.8);
        this.addLayer('cloud-band-near', 0.55, 5, 0.6);
        this.createTwinkles();

        // 2. 달 (골인 지점 뒤)
        const moon = this.add.image(GOAL.x, GOAL.y - 150, 'moon').setDepth(6);
        this.tweens.add({ targets: moon, alpha: { from: 0.9, to: 1 }, duration: 2400, yoyo: true, repeat: -1 });

        // 3. 시작 바닥 (황금 잎) + 구름 발판
        this.add.image(0, SKY_GROUND_Y - 26, 'leaf-floor').setOrigin(0).setDepth(20);
        const ground = this.add.zone(SKY_W / 2, SKY_GROUND_Y + 50, SKY_W, 100);
        this.physics.add.existing(ground, true);

        const zones = [ ...CLOUDS, GOAL ].map(cloud => this.createCloud(cloud));

        // 4. 포탈 (시작 지점, 골인 지점 모두 숲으로 돌아간다)
        const portalStyle = { texture: 'portal-sky', glow: 'glow-sky', particleTints: [ 0xe6dcff, 0x9fd8ff ] };
        [ SKY_PORTALS.start, SKY_PORTALS.goal ].forEach(({ x, y }, i) =>
        {
            const promptY = addPortal(this, x, y, { ...portalStyle, seed: i });
            this.interactions.add(x, y, '↑  숲으로 돌아가기', promptY, () => this.leave());
        });

        // 5. 플레이어
        this.player = new Player(this, SKY_START.x, SKY_START.y - 40);
        this.physics.add.collider(this.player.hitbox, ground);
        addPlatformCollider(this, this.player, zones);

        cam.startFollow(this.player.hitbox, true, 0.08, 0.1);
        cam.setDeadzone(200, 140);
        cam.centerOn(SKY_START.x, SKY_START.y - 200);
        cam.fadeIn(320, 5, 18, 28);

        // 6. 안내 + 타이머
        this.add.image(0, 0, 'vignette').setOrigin(0).setScrollFactor(0).setDepth(50);
        this.add.text(24, 20, '구름을 밟고 달까지 올라가 보세요  ·  떨어져도 아래 구름에 걸려요', {
            fontFamily: 'sans-serif', fontSize: '15px', color: '#dcd8ff'
        }).setScrollFactor(0).setAlpha(0.75).setDepth(60);

        const best = loadBest();
        this.timerText = this.add.text(VIEW_W - 24, 20, '', {
            fontFamily: 'sans-serif', fontSize: '18px', color: '#fff6d6', align: 'right',
            stroke: '#06141e', strokeThickness: 4
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(60);
        this.timerText.setData('best', best);
        this.updateTimerText(0);

        EventBus.emit('current-scene-ready', this);
    }

    update (time: number)
    {
        this.player.update(time);
        this.interactions.update(this.player, !this.leaving);
        this.updateTimer();

        const scrollY = this.cameras.main.scrollY;
        for (const layer of this.layers)
        {
            layer.sprite.tilePositionY = scrollY * layer.factor;
        }
    }

    private updateTimer ()
    {
        const now = this.time.now;

        // 시작 바닥에서 처음 발을 떼면 시작
        if (this.startedAt === null)
        {
            if (this.player.bottom < SKY_GROUND_Y - 40)
            {
                this.startedAt = now;
            }
            return;
        }

        if (this.clearedMs !== null)
        {
            return;
        }

        // 달 구름 위에 올라서면 클리어
        const onGoal = this.player.onGround
            && Math.abs(this.player.bottom - GOAL.y) < 8
            && Math.abs(this.player.x - GOAL.x) < GOAL.w / 2;

        if (onGoal)
        {
            this.clear(now - this.startedAt);
            return;
        }

        this.updateTimerText(now - this.startedAt);
    }

    private updateTimerText (ms: number)
    {
        const best: number | null = this.timerText.getData('best');
        const bestLine = best ? `\n최고 기록  ${formatTime(best)}` : '';
        this.timerText.setText(`${formatTime(ms)}${bestLine}`);
    }

    private clear (ms: number)
    {
        this.clearedMs = ms;

        const best: number | null = this.timerText.getData('best');
        const isNewBest = best === null || ms < best;
        if (isNewBest)
        {
            saveBest(ms);
            this.timerText.setData('best', ms);
        }
        this.updateTimerText(ms);

        const message = isNewBest && best !== null ? '새 기록!' : '클리어!';
        const banner = this.add.text(VIEW_W / 2, VIEW_H * 0.28, `${message}\n${formatTime(ms)}`, {
            fontFamily: 'sans-serif', fontSize: '40px', fontStyle: 'bold', color: '#ffe9a8', align: 'center',
            stroke: '#0b0a2a', strokeThickness: 7
        }).setOrigin(0.5).setScrollFactor(0).setDepth(70).setScale(0.6).setAlpha(0);

        this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 450, ease: 'Back.easeOut' });
        this.tweens.add({ targets: banner, alpha: 0, delay: 3200, duration: 800 });

        // 달에서 별가루가 터진다
        this.add.particles(GOAL.x, GOAL.y - 40, 'glow-dot', {
            tint: [ 0xffe9a8, 0xe6dcff, 0x9fd8ff ],
            speed: { min: 120, max: 320 },
            angle: { min: 200, max: 340 },
            gravityY: 300,
            scale: { start: 0.45, end: 0 },
            lifespan: 1400,
            quantity: 40,
            emitting: false,
            blendMode: 'ADD'
        }).setDepth(40).explode(40);
    }

    private leave ()
    {
        this.leaving = true;
        this.player.locked = true;
        fadeToScene(this, 'Forest', { from: 'sky' });
    }

    private createCloud (cloud: CloudDef)
    {
        const key = `cloud-${cloud.w}`;
        makeTexture(this, key, cloud.w, 56, ctx => drawCloudPlatform(ctx, cloud.w));

        const img = this.add.image(cloud.x - cloud.w / 2, cloud.y - CLOUD_TOP, key)
            .setOrigin(0)
            .setDepth(15);

        // 구름마다 조금씩 다른 박자로 숨 쉬듯 빛난다 (판정은 움직이지 않는다)
        this.tweens.add({
            targets: img,
            alpha: { from: 0.88, to: 1 },
            duration: 1800 + (cloud.x % 7) * 150,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return addOneWayPlatform(this, cloud.x - cloud.w / 2, cloud.x + cloud.w / 2, cloud.y);
    }

    private createTwinkles ()
    {
        // 반짝이는 큰 별
        this.add.particles(0, 0, 'glow-dot', {
            x: { min: 0, max: SKY_W },
            y: { min: 0, max: SKY_H },
            tint: [ 0xffffff, 0xdcd8ff, 0xfff3c0 ],
            scale: { min: 0.08, max: 0.2 },
            alpha: { start: 0, end: 1, ease: 'Sine.easeInOut' },
            lifespan: 2400,
            frequency: 60,
            blendMode: BlendModes.ADD
        }).setDepth(4);
    }

    private addLayer (key: string, factor: number, depth: number, alpha = 1)
    {
        const sprite = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, key)
            .setOrigin(0)
            .setScrollFactor(0)
            .setAlpha(alpha)
            .setDepth(depth);

        this.layers.push({ sprite, factor });
    }

    private createTextures ()
    {
        makeTexture(this, 'night-sky', VIEW_W, VIEW_H, drawNightSky);
        makeTexture(this, 'stars-far', 512, 512, ctx => drawStars(ctx, 512, 512, 140, 61));
        makeTexture(this, 'stars-near', 640, 640, ctx => drawStars(ctx, 640, 640, 60, 67));
        makeTexture(this, 'cloud-band-far', VIEW_W, 900, ctx => drawCloudBand(ctx, VIEW_W, 900, '120,110,200', 71));
        makeTexture(this, 'cloud-band-near', VIEW_W, 1100, ctx => drawCloudBand(ctx, VIEW_W, 1100, '170,160,230', 73));
        makeTexture(this, 'moon', 320, 320, drawMoon);
        makeTexture(this, 'leaf-floor', SKY_W, 140, ctx => drawLeafFloor(ctx, SKY_W, 140));
        // glow-dot, vignette는 숲에서 만든 텍스처를 같이 쓴다 (점프맵은 숲을 거쳐서만 들어온다)
        createSkyPortalTextures(this);
    }
}
