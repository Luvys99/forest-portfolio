// 다른 방문자의 정령이 받은 좌표를 부드럽게 따라가게 한다.
// 좌표는 초당 15번쯤 오므로 그대로 옮기면 뚝뚝 끊긴다. 매 프레임 남은 거리의 일정 비율만큼 다가간다

const FRAME_MS = 1000 / 60;
// 60fps 한 프레임에 남은 거리의 20% 만큼 다가간다
export const FOLLOW_RATE = 0.2;
// 이보다 멀면 따라가지 않고 바로 옮긴다 (포탈 이동, 재접속, 처음 나타날 때)
export const SNAP_DISTANCE = 400;

export interface Point
{
    x: number;
    y: number;
}

// 프레임이 길든 짧든(30fps, 144fps) 같은 시간이면 같은 만큼 다가간다
export function followPoint (current: Point, target: Point, deltaMs: number, rate = FOLLOW_RATE, snapDistance = SNAP_DISTANCE): Point
{
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    if (Math.hypot(dx, dy) > snapDistance)
    {
        return { x: target.x, y: target.y };
    }
    const k = 1 - Math.pow(1 - rate, deltaMs / FRAME_MS);
    return { x: current.x + dx * k, y: current.y + dy * k };
}
