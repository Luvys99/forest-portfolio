import { GameObjects, Scene } from 'phaser';
import { Move, PlayerState, RemotePlayer as RemotePlayerInfo } from '../../lib/relay';
import { followPoint } from '../world/interpolation';
import { addSpirit, applySpiritPose, SpiritImages } from './spirit';
import { decayLandSquash, PoseMode, spiritPose, WALK_SPEED } from './spirit-pose';

// 내 정령(23, 24)보다 뒤, 빛나는 식물(21, 22)보다 앞
const GLOW_DEPTH = 22.3;
const SPRITE_DEPTH = 22.6;
const NAME_DEPTH = 29;
const NAME_ABOVE_FEET = 82;

const POSE_MODE: Record<PlayerState, PoseMode> = {
    idle: 'ground',
    walk: 'ground',
    jump: 'air',
    climb: 'climb'
};

// 다른 방문자의 정령. 물리 body 와 키 입력 없이, 받은 좌표를 부드럽게 따라가며 그리기만 한다.
// 포탈·구슬 상호작용, 발판 충돌과 상관없다
export class RemotePlayer
{
    private readonly spirit: SpiritImages;
    private readonly nameTag: GameObjects.Text;

    // 지금 그려진 발 위치 (target 을 따라간다)
    private x: number;
    private feetY: number;
    private target: Move;
    private prevState: PlayerState;
    private landSquash = 0;

    constructor (scene: Scene, info: RemotePlayerInfo)
    {
        this.x = info.x;
        this.feetY = info.y;
        this.target = { x: info.x, y: info.y, facing: info.facing, state: info.state };
        this.prevState = info.state;

        this.spirit = addSpirit(scene, info.x, info.y, {
            glowColor: parseInt(info.color, 16),
            glowDepth: GLOW_DEPTH,
            spriteDepth: SPRITE_DEPTH
        });

        this.nameTag = scene.add.text(info.x, info.y - NAME_ABOVE_FEET, info.name, {
            fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: `#${info.color}`,
            stroke: '#06141e', strokeThickness: 4
        }).setOrigin(0.5).setDepth(NAME_DEPTH);
    }

    setTarget (move: Move)
    {
        this.target = { x: move.x, y: move.y, facing: move.facing, state: move.state };
    }

    update (time: number, delta: number)
    {
        const prevY = this.feetY;
        const next = followPoint({ x: this.x, y: this.feetY }, this.target, delta);
        this.x = next.x;
        this.feetY = next.y;

        const { facing, state } = this.target;
        if (this.prevState === 'jump' && (state === 'idle' || state === 'walk'))
        {
            this.landSquash = 1;
        }
        this.prevState = state;
        this.landSquash = decayLandSquash(this.landSquash, delta);

        // 받은 것은 상태뿐이라 속도는 화면에서 움직인 만큼으로 어림한다
        const pose = spiritPose({
            mode: POSE_MODE[state],
            vx: state === 'walk' ? facing * WALK_SPEED * 2 : 0,
            vy: delta > 0 ? (this.feetY - prevY) / delta * 1000 : 0,
            time,
            climbY: this.feetY,
            landSquash: this.landSquash
        });
        applySpiritPose(this.spirit, this.x, this.feetY, facing, pose);
        this.nameTag.setPosition(this.x, this.feetY - NAME_ABOVE_FEET);
    }

    destroy ()
    {
        this.spirit.sprite.destroy();
        this.spirit.glow.destroy();
        this.nameTag.destroy();
    }
}
