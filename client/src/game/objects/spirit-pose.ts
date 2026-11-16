// 정령 그림 연출 계산: 숨쉬기, 달릴 때 통통 튀기, 점프할 때 늘어나기, 착지할 때 눌리기, 사다리 탈 때 흔들기.
// 내 캐릭터(Player)와 다른 방문자(RemotePlayer)가 같이 쓴다. Phaser 없는 순수 함수라 테스트에서 바로 부른다

export type PoseMode = 'ground' | 'air' | 'climb';

export interface PoseInput
{
    mode: PoseMode;
    // 속도 (px/s). 달리는 모습과 점프 늘어남에 쓴다
    vx: number;
    vy: number;
    time: number;
    // 사다리에서 흔들리는 박자 (높이에 따라 바뀐다)
    climbY: number;
    // 착지 직후 1에서 0으로 줄어드는 값
    landSquash: number;
}

export interface Pose
{
    sx: number;
    sy: number;
    offsetY: number;
    rotation: number;
}

// 이보다 빠르면 달리는 모습. 다른 방문자에게 'walk' 상태를 보낼 때도 같은 기준을 쓴다
export const WALK_SPEED = 20;

export function spiritPose (input: PoseInput): Pose
{
    let sx = 1;
    let sy = 1;
    let offsetY = 0;
    let rotation = 0;

    if (input.mode === 'climb')
    {
        rotation = Math.sin(input.climbY * 0.06) * 0.1;
    }
    else if (input.mode === 'ground')
    {
        if (Math.abs(input.vx) > WALK_SPEED)
        {
            offsetY = -Math.abs(Math.sin(input.time * 0.018)) * 5;
            rotation = 0.06 * Math.sign(input.vx);
        }
        else
        {
            const breathe = Math.sin(input.time * 0.004) * 0.035;
            sy += breathe;
            sx -= breathe;
        }
    }
    else
    {
        const stretch = Math.min(0.18, Math.max(-0.12, -input.vy / 2600));
        sy += stretch;
        sx -= stretch * 0.6;
    }

    sy *= 1 - 0.22 * input.landSquash;
    sx *= 1 + 0.18 * input.landSquash;

    return { sx, sy, offsetY, rotation };
}

// 착지 찌그러짐은 0.35초 동안 거의 0으로 줄어든다
export function decayLandSquash (squash: number, deltaMs: number)
{
    return squash * Math.pow(0.0001, deltaMs / 1000 / 0.35);
}
