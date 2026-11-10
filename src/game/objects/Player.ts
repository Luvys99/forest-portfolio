import { BlendModes, GameObjects, Input, Math as PhaserMath, Scene } from 'phaser';
import { LadderDef } from '../world/layout';

// 이동 감각 조절 값
const MAX_SPEED = 260;
const GROUND_ACCEL = 2600;
const AIR_ACCEL = 1600;
const DRAG = 2400;
const JUMP_VELOCITY = 640;       // 메이플처럼 키를 얼마나 누르든 항상 같은 높이로 뛴다
const COYOTE_MS = 90;            // 발판에서 막 떨어진 직후에도 점프 허용
const JUMP_BUFFER_MS = 120;      // 착지 직전에 누른 점프도 기억해 뒀다가 실행
const CLIMB_SPEED = 220;
const LADDER_GRAB_RANGE = 22;    // 사다리 가운데에서 이 거리 안이면 잡을 수 있다
const DROP_THROUGH_MS = 250;     // ↓ + 점프로 발판 아래로 내려갈 때 통과 시간
const KNOCKBACK_X = 320;         // 맞았을 때 튕겨 나가는 속도
const KNOCKBACK_Y = 380;
const STUN_MS = 380;             // 튕겨 나가는 동안은 조작할 수 없다
const INVINCIBLE_MS = 1300;      // 맞은 뒤 잠깐은 다시 맞지 않는다 (깜빡임)

// 히트박스 크기 (그림과 별개)
const HITBOX_W = 34;
const HITBOX_H = 46;

type Keys = Record<'left' | 'right' | 'up' | 'down', Input.Keyboard.Key>;

// 점프 키는 keyCode가 아니라 키보드의 물리적 위치(event.code)로 확인한다.
// Mac에서 한글 입력 상태일 때 브라우저가 keyCode를 229로 보내는 경우가 있어서,
// keyCode로 키를 구분하는 Phaser의 키 객체로는 Option(Alt)을 놓칠 수 있다.
const JUMP_CODES = [ 'Space', 'AltLeft', 'AltRight' ];

const isJumpKey = (event: KeyboardEvent) => JUMP_CODES.includes(event.code) || event.key === 'Alt' || event.key === ' ';

// 플레이어 = 물리 판정용 히트박스(Zone) + 보이는 그림(Image)
// 그림을 늘리고 줄이는 연출이 물리 판정 크기에 영향을 주지 않도록 둘을 나눴다.
// 나중에 스프라이트 캐릭터로 바꿀 때는 sprite 부분만 교체하면 된다.
export class Player
{
    readonly hitbox: GameObjects.Zone;
    readonly body: Phaser.Physics.Arcade.Body;

    ladders: LadderDef[] = [];
    locked = false;              // 포탈 이동 중에는 조작을 막는다

    private sprite: GameObjects.Image;
    private glow: GameObjects.Image;
    private keys: Keys;
    private jumpKeysHeld = new Set<string>();
    private jumpPressed = false;

    private now = 0;
    private lastGroundedAt = -Infinity;
    private lastJumpPressedAt = -Infinity;
    private lastOnPlatformAt = -Infinity;
    private dropUntil = -Infinity;
    private climbing: LadderDef | null = null;
    private wasOnGround = false;
    private landSquash = 0;
    private facing = 1;
    private stunUntil = -Infinity;
    private invincibleUntil = -Infinity;

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
            left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN'
        }) as Keys;

        // 물리 계산이 끝난 뒤(postupdate)에 그림 위치를 맞춰야 한 프레임 늦게 따라오지 않는다
        scene.events.on('postupdate', this.syncVisual, this);

        // 점프 키(Space, Alt/Option)는 브라우저 이벤트를 직접 받는다.
        // Alt는 브라우저 메뉴 단축키라서, 떼는 순간 키보드 입력이 브라우저 메뉴로 넘어갈 수 있으므로 (Windows) 기본 동작도 막는다.
        // 모달 버튼이나 링크에 포커스가 있을 때는 Space가 그 버튼을 누르도록 놔둔다
        const isUiTarget = (event: KeyboardEvent) =>
            event.target instanceof Element && event.target.closest('button, a, input, textarea') !== null;

        const onKeyDown = (event: KeyboardEvent) =>
        {
            if (!isJumpKey(event) || isUiTarget(event))
            {
                return;
            }
            event.preventDefault();

            // 누르고 있는 동안 반복해서 들어오는 keydown은 새 점프로 치지 않는다
            if (!event.repeat && !this.jumpKeysHeld.has(event.code))
            {
                this.jumpPressed = true;
            }
            this.jumpKeysHeld.add(event.code);
        };
        const onKeyUp = (event: KeyboardEvent) =>
        {
            if (!isJumpKey(event) || isUiTarget(event))
            {
                return;
            }
            event.preventDefault();
            this.jumpKeysHeld.delete(event.code);
        };
        // 다른 창으로 전환하면 keyup을 못 받으므로 눌린 키 기록을 비운다
        const onBlur = () => this.jumpKeysHeld.clear();

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);

        // 씬이 끝나거나 게임이 지워질 때 리스너를 꼭 정리한다
        // (React 개발 모드는 게임을 만들었다 지우고 다시 만들어서, 정리하지 않으면 이전 리스너가 남는다)
        const cleanup = () =>
        {
            scene.events.off('postupdate', this.syncVisual, this);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
        scene.events.once('shutdown', cleanup);
        scene.events.once('destroy', cleanup);
        scene.game.events.once('destroy', cleanup);
    }

    // 이번 프레임에 점프 키를 새로 눌렀는지 (한 번 확인하면 지운다)
    private consumeJump ()
    {
        const pressed = this.jumpPressed;
        this.jumpPressed = false;
        return pressed;
    }

    get x ()
    {
        return this.hitbox.x;
    }

    get bottom ()
    {
        return this.hitbox.y + HITBOX_H / 2;
    }

    get onGround ()
    {
        return this.body.blocked.down || this.body.touching.down;
    }

    // 사다리를 타는 중이거나 ↓ + 점프로 내려가는 중이면 발판을 통과한다
    get passThrough ()
    {
        return this.climbing !== null || this.now < this.dropUntil;
    }

    // 발판 충돌 콜백에서 호출: 지금 발판(땅이 아닌) 위에 서 있다는 표시
    markOnPlatform ()
    {
        this.lastOnPlatformAt = this.now;
    }

    // ↑ 키를 이번 프레임에 눌렀는지 (상호작용용)
    justPressedUp ()
    {
        return Input.Keyboard.JustDown(this.keys.up);
    }

    get invincible ()
    {
        return this.now < this.invincibleUntil;
    }

    // 맞으면 맞은 반대쪽(dir)으로 튕겨 나간다. 체력은 없고, 구름에서 떨어지는 것이 벌이다
    knockback (dir: number)
    {
        if (this.invincible)
        {
            return;
        }

        this.stopClimbing();
        this.body.setVelocity(dir * KNOCKBACK_X, -KNOCKBACK_Y);
        // 튕겨 나가는 동안은 마찰을 꺼야 옆으로 밀려난다
        this.body.setDragX(0);
        this.stunUntil = this.now + STUN_MS;
        this.invincibleUntil = this.now + INVINCIBLE_MS;
    }

    // 발 위치(feetY)를 기준으로 순간이동
    teleport (x: number, feetY: number)
    {
        this.stopClimbing();
        this.body.reset(x, feetY - HITBOX_H / 2 - 1);
    }

    update (time: number)
    {
        this.now = time;

        if (this.locked || time < this.stunUntil)
        {
            this.body.setAccelerationX(0);
            this.consumeJump();
            return;
        }
        this.body.setDragX(DRAG);

        if (this.climbing)
        {
            this.updateClimbing(this.climbing);
            return;
        }

        const { left, right, up, down } = this.keys;
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

        // 사다리 잡기: 사다리 옆에서 ↑, 사다리 꼭대기에 서서 ↓
        const ladder = this.ladders.find(l =>
            Math.abs(this.x - l.x) < LADDER_GRAB_RANGE && this.bottom >= l.top - 12 && this.bottom <= l.bottom + 2);

        if (ladder)
        {
            const belowTop = this.bottom > ladder.top + 6;
            const standingOnTop = onGround && Math.abs(this.bottom - ladder.top) < 10;
            if ((up.isDown && belowTop) || (down.isDown && standingOnTop))
            {
                this.startClimbing(ladder);
                return;
            }
        }

        // 점프: 코요테 타임 + 점프 버퍼
        if (onGround)
        {
            this.lastGroundedAt = time;
        }
        if (this.consumeJump())
        {
            const onPlatform = time - this.lastOnPlatformAt < 80;
            if (down.isDown && onGround && onPlatform)
            {
                // ↓ + 점프: 발판 아래로 내려가기
                this.dropUntil = time + DROP_THROUGH_MS;
            }
            else
            {
                this.lastJumpPressedAt = time;
            }
        }

        const canJump = time - this.lastGroundedAt <= COYOTE_MS;
        const wantsJump = time - this.lastJumpPressedAt <= JUMP_BUFFER_MS;
        if (canJump && wantsJump)
        {
            this.body.setVelocityY(-JUMP_VELOCITY);
            this.lastGroundedAt = -Infinity;
            this.lastJumpPressedAt = -Infinity;
        }
    }

    private startClimbing (ladder: LadderDef)
    {
        this.climbing = ladder;
        this.body.setAllowGravity(false);
        this.body.setAcceleration(0, 0);
        // 물리 계산 뒤에 위치가 덮어써지지 않도록 body 기준으로 사다리 가운데에 맞춘다
        this.body.reset(ladder.x, this.hitbox.y);
    }

    private stopClimbing ()
    {
        this.climbing = null;
        this.body.setAllowGravity(true);
    }

    private updateClimbing (ladder: LadderDef)
    {
        const { left, right, up, down } = this.keys;

        const vy = up.isDown ? -CLIMB_SPEED : down.isDown ? CLIMB_SPEED : 0;
        this.body.setVelocity(0, vy);

        // 사다리에서 옆으로 점프해서 내리기
        const jumped = this.consumeJump();
        const dir = left.isDown ? -1 : right.isDown ? 1 : 0;
        if (jumped && dir !== 0)
        {
            this.stopClimbing();
            this.facing = dir;
            this.body.setVelocity(dir * MAX_SPEED * 0.8, -JUMP_VELOCITY * 0.6);
            return;
        }

        // 꼭대기에 닿으면 위 발판에 올려 준다
        if (vy < 0 && this.bottom <= ladder.top)
        {
            this.stopClimbing();
            this.body.reset(ladder.x, ladder.top - HITBOX_H / 2 - 1);
            return;
        }

        // 바닥에 닿으면 내려 준다
        if (vy > 0 && this.bottom >= ladder.bottom - 1)
        {
            this.stopClimbing();
            this.body.reset(ladder.x, ladder.bottom - HITBOX_H / 2 - 1);
        }
    }

    // 그림 연출: 숨쉬기, 달릴 때 통통 튀기, 점프할 때 늘어나기, 착지할 때 눌리기, 사다리 탈 때 흔들기
    private syncVisual (time: number, delta: number)
    {
        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;
        const onGround = this.onGround;

        if (onGround && !this.wasOnGround && !this.climbing)
        {
            this.landSquash = 1;
        }
        this.wasOnGround = onGround;
        this.landSquash *= Math.pow(0.0001, delta / 1000 / 0.35);

        let sx = 1;
        let sy = 1;
        let offsetY = 0;
        let rotation = 0;

        if (this.climbing)
        {
            rotation = Math.sin(this.hitbox.y * 0.06) * 0.1;
        }
        else if (onGround)
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

        const footY = this.bottom;
        this.sprite
            .setPosition(this.hitbox.x, footY + offsetY)
            .setScale(sx * 1.1, sy * 1.1)
            .setRotation(rotation)
            .setFlipX(this.facing < 0);

        this.glow.setPosition(this.hitbox.x, footY - 28 + offsetY);

        // 무적 시간 동안 깜빡인다
        const blink = this.invincible && Math.floor(time / 90) % 2 === 0;
        this.sprite.setAlpha(blink ? 0.3 : 1);
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
