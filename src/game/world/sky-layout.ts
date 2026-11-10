import { VIEW_W } from './layout';

// 밤하늘 점프맵 배치 (화면 너비 그대로, 위로 길게 올라간다)
//
//            [골인: 달 구름]          ← GOAL_Y
//          ☁       ☁
//     ☁═══ 넓은 쉼터 구름 ═══☁       ← 떨어져도 여기에 걸린다
//          ☁   ☁
//   [돌아가는 포탈]   시작            ← SKY_GROUND_Y (황금 잎 위)

export const SKY_W = VIEW_W;
export const SKY_H = 3400;
export const SKY_GROUND_Y = SKY_H - 90;

// 한 칸 올라가는 높이 (점프 최고 높이 약 128px보다 낮게)
const STEP = 104;

export interface CloudDef
{
    x: number;
    y: number;
    w: number;
}

// [가운데 x, 너비]를 아래에서 위로 순서대로. 넓은 구름(360)은 쉼터
const PATH: [ number, number ][] = [
    [ 640, 170 ], [ 470, 160 ], [ 300, 160 ], [ 450, 150 ], [ 620, 150 ], [ 800, 150 ],
    [ 640, 360 ],
    [ 880, 140 ], [ 1050, 130 ], [ 880, 130 ], [ 700, 130 ], [ 520, 120 ], [ 350, 120 ],
    [ 600, 360 ],
    [ 250, 120 ], [ 420, 110 ], [ 600, 110 ], [ 790, 110 ], [ 970, 110 ], [ 1100, 110 ],
    [ 760, 360 ],
    [ 960, 110 ], [ 780, 100 ], [ 600, 100 ], [ 420, 100 ], [ 560, 100 ]
];

export const CLOUDS: CloudDef[] = PATH.map(([ x, w ], i) => ({ x, w, y: SKY_GROUND_Y - STEP * (i + 1) }));

// 마지막 구름 한 칸 위의 달 구름
export const GOAL: CloudDef = { x: 640, w: 380, y: SKY_GROUND_Y - STEP * (PATH.length + 1) };

export const SKY_PORTALS = {
    // 시작 지점에서 숲으로 돌아가기
    start: { x: 180, y: SKY_GROUND_Y },
    // 골인 지점에서 숲으로 돌아가기
    goal: { x: GOAL.x + 120, y: GOAL.y }
};

export const SKY_START = { x: 380, y: SKY_GROUND_Y };
