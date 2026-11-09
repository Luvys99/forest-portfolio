import { BlendModes, GameObjects, Input, Math as PhaserMath, Scene } from 'phaser';

// 이동 감각 조절 값
const MAX_SPEED = 260;
const GROUND_ACCEL = 2600;
const AIR_ACCEL = 1600;
const DRAG = 2400;
const JUMP_VELOCITY = 640;
const JUMP_CUT_VELOCITY = 260;   // 점프 키를 일찍 떼면 이 속도로 줄여서 낮게 뛴다
const COYOTE_MS = 90;            // 발판에서 막 떨어진 직후에도 점프 허용
const JUMP_BUFFER_MS = 120;      // 착지 직전에 누른 점프도 기억해 뒀다가 실행

// 히트박스 크기 (그림과 별개)
const HITBOX_W = 34;
const HITBOX_H = 46;

type Keys = Record<'left' | 'right' | 'up' | 'space' | 'alt', Input.Keyboard.Key>;

// 플레이어 = 물리 판정용 히트박스(Zone) + 보이는 그림(Image)
// 그림을 늘리고 줄이는 연출이 물리 판정 크기에 영향을 주지 않도록 둘을 나눴다.
// 나중에 스프라이트 캐릭터로 바꿀 때는 sprite 부분만 교체하면 된다.
export class Player
{
    readonly hitbox: GameObjects.Zone;
    readonly body: Phaser.Physics.Arcade.Body;

    private sprite: GameObjects.Image;
    private glow: GameObjects.Image;
    private keys: Keys;

    private lastGroundedAt = -Infinity;
    private lastJumpPressedAt = -Infinity;
    private wasOnGround = false;
    private landSquash = 0;
    private facing = 1;

    constructor (scene: Scene, x: number, y: number)
    {
        Player.createTexture(scene);

        this.hitbox = scene.add.zone(x, y, HITBOX_W, HITBOX_H);
        scene.physics.add.existing(this.hitbox);
        this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setMaxVelocity(MAX_SPEED, 1400);
        this.body.setDragX(DRAG);

        this.glow = scene.add.image(x, y, 'glow-dot')
            .setTint(0x9dffd8)
            .setScale(2.4)
            .setBlendMode(BlendModes.ADD)
            .setAlpha(0.45)
            .setDepth(23);

        this.sprite = scene.add.image(x, y, 'spirit')
            .setOrigin(0.5, 58 / 64)
            .setDepth(24);

        this.keys = scene.input.keyboard!.addKeys({
            left: 'LEFT', right: 'RIGHT', up: 'UP', space: 'SPACE', alt: 'ALT'
        }) as Keys;

        // 물리 계산이 끝난 뒤(postupdate)에 그림 위치를 맞춰야 한 프레임 늦게 따라오지 않는다
        scene.events.on('postupdate', this.syncVisual, this);
        scene.events.once('shutdown', () => scene.events.off('postupdate', this.syncVisual, this));
    }

    get x ()
    {
        return this.hitbox.x;
    }

    get onGround ()
    {
        return this.body.blocked.down || this.body.touching.down;
    }

    // ↑ 키를 이번 프레임에 눌렀는지 (상호작용용)
    justPressedUp ()
    {
        return Input.Keyboard.JustDown(this.keys.up);
    }

    update (time: number)
    {
        const { left, right, space, alt } = this.keys;
        const onGround = this.onGround;

        // 좌우 이동: 가속도로 움직이고, 키를 떼면 마찰(drag)로 멈춘다
        const accel = onGround ? GROUND_ACCEL : AIR_ACCEL;
        if (left.isDown && !right.isDown)
        {
            this.body.setAccelerationX(-accel);
            this.facing = -1;
        }
        else if (right.isDown && !left.isDown)
        {
            this.body.setAccelerationX(accel);
            this.facing = 1;
        }
        else
        {
            this.body.setAccelerationX(0);
        }

        // 점프: 코요테 타임 + 점프 버퍼
        if (onGround)
        {
            this.lastGroundedAt = time;
        }
        if (Input.Keyboard.JustDown(space) || Input.Keyboard.JustDown(alt))
        {
            this.lastJumpPressedAt = time;
        }

        const canJump = time - this.lastGroundedAt <= COYOTE_MS;
        const wantsJump = time - this.lastJumpPressedAt <= JUMP_BUFFER_MS;
        if (canJump && wantsJump)
        {
            this.body.setVelocityY(-JUMP_VELOCITY);
            this.lastGroundedAt = -Infinity;
            this.lastJumpPressedAt = -Infinity;
        }

        // 점프 키를 일찍 떼면 낮게 뛴다
        const holdingJump = space.isDown || alt.isDown;
        if (!holdingJump && this.body.velocity.y < -JUMP_CUT_VELOCITY)
        {
            this.body.setVelocityY(-JUMP_CUT_VELOCITY);
        }
    }

    // 그림 연출: 숨쉬기, 달릴 때 통통 튀기, 점프할 때 늘어나기, 착지할 때 눌리기
    private syncVisual (time: number, delta: number)
    {
        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;
        const onGround = this.onGround;

        if (onGround && !this.wasOnGround)
        {
            this.landSquash = 1;
        }
        this.wasOnGround = onGround;
        this.landSquash *= Math.pow(0.0001, delta / 1000 / 0.35);

        let sx = 1;
        let sy = 1;
        let offsetY = 0;
        let rotation = 0;

        if (onGround)
        {
            if (Math.abs(vx) > 20)
            {
                offsetY = -Math.abs(Math.sin(time * 0.018)) * 5;
                rotation = 0.06 * Math.sign(vx);
            }
            else
            {
                const breathe = Math.sin(time * 0.004) * 0.035;
                sy += breathe;
                sx -= breathe;
            }
        }
        else
        {
            const stretch = PhaserMath.Clamp(-vy / 2600, -0.12, 0.18);
            sy += stretch;
            sx -= stretch * 0.6;
        }

        sy *= 1 - 0.22 * this.landSquash;
        sx *= 1 + 0.18 * this.landSquash;

        const footY = this.hitbox.y + HITBOX_H / 2;
        this.sprite
            .setPosition(this.hitbox.x, footY + offsetY)
            .setScale(sx * 1.1, sy * 1.1)
            .setRotation(rotation)
            .setFlipX(this.facing < 0);

        this.glow.setPosition(this.hitbox.x, footY - 28 + offsetY);
    }

    // 숲의 정령 (임시 캐릭터)
    private static createTexture (scene: Scene)
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
}
