// 밤하늘 점프맵 배치 (화면 2개 너비, 좌우로 크게 오가며 위로 올라간다)
//
//                        [골인: 달 구름]                    ← GOAL.y
//      ☁ ☁ ☁ ☁ ☁ ←←←←←←←←←←←←←←←←← [쉼터]
//   [쉼터] →→→→→→→→→→→→→→→→→→→→→→ ☁ ☁ ☁
//      ☁ ☁ ☁ ←←←←←←←←←←←←←←←←←←←← [쉼터]
//   [포탈] 시작 →→→→→→→→→→→→→→→→→→ ☁ ☁                ← SKY_GROUND_Y (황금 잎 위)

export const SKY_W = 2560;

// 한 칸 높이 (점프 최고 높이 약 128px보다 낮게)
const UP = 104;
const HALF = 60;

export interface CloudDef
{
    x: number;
    y: number;
    w: number;
}

// [가운데 x, 너비, 앞 구름보다 얼마나 높은지]를 아래에서 위로 순서대로
// 높이 0은 같은 높이로 옆으로 건너뛰기, 너비 360 이상은 쉼터 (떨어지면 여기에 걸린다)
const PATH: [ number, number, number ][] = [
    // 1구간: 오른쪽으로
    [ 620, 170, UP ], [ 820, 150, UP ], [ 1030, 140, HALF ], [ 1250, 140, 0 ], [ 1460, 130, UP ], [ 1680, 130, HALF ],
    [ 2000, 380, UP ],
    // 2구간: 왼쪽으로
    [ 1720, 130, UP ], [ 1520, 120, UP ], [ 1300, 120, 0 ], [ 1090, 120, UP ], [ 880, 110, HALF ], [ 660, 110, 0 ],
    [ 380, 360, UP ],
    // 3구간: 다시 오른쪽으로 (구름이 작아진다)
    [ 640, 110, UP ], [ 850, 110, UP ], [ 1060, 100, HALF ], [ 1280, 100, 0 ], [ 1490, 100, UP ], [ 1700, 100, HALF ], [ 1910, 100, 0 ],
    [ 2220, 360, UP ],
    // 4구간: 달을 향해 왼쪽으로
    [ 1960, 100, UP ], [ 1760, 100, UP ], [ 1560, 100, HALF ], [ 1360, 100, 0 ], [ 1160, 100, UP ]
];

const GOAL_RISE = UP;
const TOTAL_RISE = PATH.reduce((sum, [ , , rise ]) => sum + rise, 0) + GOAL_RISE;

// 달이 들어갈 하늘 여유 + 시작 바닥
const TOP_MARGIN = 460;
const BOTTOM_MARGIN = 90;

export const SKY_H = TOP_MARGIN + TOTAL_RISE + BOTTOM_MARGIN;
export const SKY_GROUND_Y = SKY_H - BOTTOM_MARGIN;

export const CLOUDS: CloudDef[] = [];
let y = SKY_GROUND_Y;
for (const [ x, w, rise ] of PATH)
{
    y -= rise;
    CLOUDS.push({ x, w, y });
}

// 마지막 구름 한 칸 위의 달 구름
export const GOAL: CloudDef = { x: 980, w: 380, y: y - GOAL_RISE };

export const SKY_PORTALS = {
    // 시작 지점에서 숲으로 돌아가기
    start: { x: 180, y: SKY_GROUND_Y },
    // 골인 지점에서 숲으로 돌아가기
    goal: { x: GOAL.x + 120, y: GOAL.y }
};

export const SKY_START = { x: 380, y: SKY_GROUND_Y };
