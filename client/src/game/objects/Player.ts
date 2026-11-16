import { GameObjects, Input, Scene } from 'phaser';
import { LadderDef } from '../world/layout';
import { JUMP_VELOCITY } from '../physics';
import { Facing, PlayerState } from '../../lib/relay';
import { PALETTE } from '../../lib/identity';
import { addSpirit, applySpiritPose, SpiritImages } from './spirit';
import { controls } from '../../lib/controls';
import { decayLandSquash, spiritPose, WALK_SPEED } from './spirit-pose';

// 이동 감각 조절 값
const MAX_SPEED = 260;
const GROUND_ACCEL = 2600;
const AIR_ACCEL = 1600;
const DRAG = 2400;
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

    private spirit: SpiritImages;
    private keys: Keys;
    private jumpKeysHeld = new Set<string>();
    private jumpPressed = false;
    private upTouchedThisFrame = false;

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
        this.hitbox = scene.add.zone(x, y, HITBOX_W, HITBOX_H);
        scene.physics.add.existing(this.hitbox);
        this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setMaxVelocity(MAX_SPEED, 1400);
        this.body.setDragX(DRAG);

        // 내 정령은 다른 방문자들보다 앞에 그린다 (RemotePlayer 는 이보다 낮은 depth)
        this.spirit = addSpirit(scene, x, y, { glowColor: parseInt(PALETTE[0].hex, 16), glowDepth: 23, spriteDepth: 24 });

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

    // 정령 색 (hex 6자리, '#' 없이). 멀티플레이 입장 때 고른 색
    setGlowColor (hex: string)
    {
        this.spirit.glow.setTint(parseInt(hex, 16));
    }

    // 다른 방문자에게 보내는 내 상태
    get moveState (): PlayerState
    {
        if (this.climbing)
        {
            return 'climb';
        }
        if (!this.onGround)
        {
            return 'jump';
        }
        return Math.abs(this.body.velocity.x) > WALK_SPEED ? 'walk' : 'idle';
    }

    get facingDir (): Facing
    {
        return this.facing < 0 ? -1 : 1;
    }

    // 이번 프레임의 방향 입력: 키보드 방향키와 화면 터치 버튼(lib/controls)을 합친다.
    // 이동·사다리 로직은 이 함수만 읽으므로 입력이 어디서 왔는지 모른다
    private readDirections ()
    {
        return {
            left: this.keys.left.isDown || controls.isDown('left'),
            right: this.keys.right.isDown || controls.isDown('right'),
            up: this.keys.up.isDown || controls.isDown('up'),
            down: this.keys.down.isDown || controls.isDown('down')
        };
    }

    // 이번 프레임에 점프를 새로 눌렀는지 (점프 키 또는 터치 점프 버튼. 한 번 확인하면 지운다)
    private consumeJump ()
    {
        const touched = controls.consumePressed('jump');
        const pressed = this.jumpPressed || touched;
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

    // ↑ 를 이번 프레임에 눌렀는지 (구슬·포탈 상호작용용). 터치 ↑ 는 update() 에서 매 프레임 확인해 둔다
    justPressedUp ()
    {
        return Input.Keyboard.JustDown(this.keys.up) || this.upTouchedThisFrame;
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
        // 상호작용 대상 근처가 아닐 때 누른 터치 ↑ 가 남아 있다가 나중에 반응하지 않게, 매 프레임 확인하고 지운다
        this.upTouchedThisFrame = controls.consumePressed('up');

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

        const { left, right, up, down } = this.readDirections();
        const onGround = this.onGround;

        // 좌우 이동: 가속도로 움직이고, 키를 떼면 마찰(drag)로 멈춘다
        const accel = onGround ? GROUND_ACCEL : AIR_ACCEL;
        if (left && !right)
        {
            this.body.setAccelerationX(-accel);
            this.facing = -1;
        }
        else if (right && !left)
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
            if ((up && belowTop) || (down && standingOnTop))
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
            if (down && onGround && onPlatform)
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
        const { left, right, up, down } = this.readDirections();

        const vy = up ? -CLIMB_SPEED : down ? CLIMB_SPEED : 0;
        this.body.setVelocity(0, vy);

        // 사다리에서 옆으로 점프해서 내리기
        const jumped = this.consumeJump();
        const dir = left ? -1 : right ? 1 : 0;
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

    // 그림 연출은 spirit-pose.ts 가 계산한다 (다른 방문자의 정령과 같은 계산)
    private syncVisual (time: number, delta: number)
    {
        const onGround = this.onGround;
        if (onGround && !this.wasOnGround && !this.climbing)
        {
            this.landSquash = 1;
        }
        this.wasOnGround = onGround;
        this.landSquash = decayLandSquash(this.landSquash, delta);

        const pose = spiritPose({
            mode: this.climbing ? 'climb' : onGround ? 'ground' : 'air',
            vx: this.body.velocity.x,
            vy: this.body.velocity.y,
            time,
            climbY: this.hitbox.y,
            landSquash: this.landSquash
        });
        applySpiritPose(this.spirit, this.hitbox.x, this.bottom, this.facing, pose);

        // 무적 시간 동안 깜빡인다
        const blink = this.invincible && Math.floor(time / 90) % 2 === 0;
        this.spirit.sprite.setAlpha(blink ? 0.3 : 1);
    }
}
