// 맵 배치 (좌표는 모두 월드 기준, y는 아래로 갈수록 커진다)
//
//                 [위 포탈]  [소개]          ← 나무 꼭대기 (CANOPY_Y)
//           ~~~~~~~~ 황금 잎 ~~~~~~~~
//   [2층 왼쪽]═══╗   줄기   ╔═══[2층 오른쪽]   ← FLOOR_2_Y
//      사다리     ║         ║     사다리
//   [1층 왼쪽]═══╣         ╠═══[1층 오른쪽]   ← FLOOR_1_Y
//      사다리     ║ [아래 포탈] ║     사다리
// ───────────────────────────────────────── ← GROUND_Y

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 3840;
export const WORLD_H = 2160;

export const GROUND_Y = 2040;
export const TREE_X = 1920;
export const FLOOR_1_Y = GROUND_Y - 380;
export const FLOOR_2_Y = GROUND_Y - 760;
export const CANOPY_Y = 536;

// 큰 나무 텍스처 크기 (밑동 가운데를 (TREE_X, GROUND_Y)에 맞춘다)
export const BIG_TREE_W = 2400;
export const BIG_TREE_H = 1700;
export const toTreeY = (worldY: number) => worldY - (GROUND_Y + 6 - BIG_TREE_H);

export interface PlatformDef
{
    x1: number;
    x2: number;
    y: number;
    side: 'left' | 'right' | 'top';
}

// 아래에서 점프하면 통과하고, 위에서는 밟을 수 있는 발판
export const PLATFORMS: PlatformDef[] = [
    { x1: TREE_X - 780, x2: TREE_X - 110, y: FLOOR_1_Y, side: 'left' },
    { x1: TREE_X - 740, x2: TREE_X - 100, y: FLOOR_2_Y, side: 'left' },
    { x1: TREE_X + 110, x2: TREE_X + 780, y: FLOOR_1_Y, side: 'right' },
    { x1: TREE_X + 100, x2: TREE_X + 740, y: FLOOR_2_Y, side: 'right' },
    { x1: TREE_X - 520, x2: TREE_X + 520, y: CANOPY_Y, side: 'top' }
];

export interface LadderDef
{
    x: number;
    top: number;
    bottom: number;
}

export const LADDERS: LadderDef[] = [
    { x: TREE_X - 700, top: FLOOR_1_Y, bottom: GROUND_Y },
    { x: TREE_X - 640, top: FLOOR_2_Y, bottom: FLOOR_1_Y },
    { x: TREE_X + 700, top: FLOOR_1_Y, bottom: GROUND_Y },
    { x: TREE_X + 640, top: FLOOR_2_Y, bottom: FLOOR_1_Y }
];

export interface SpotDef
{
    id: string;
    title: string;
    subtitle: string;
    x: number;
    y: number;
}

// 발판마다 프로젝트 하나 (내용은 나중에 projects.json으로 옮길 예정)
export const PROJECT_SPOTS: SpotDef[] = [
    { id: 'graduation', title: '졸업 작품', subtitle: 'Reflecxity · AI 음성 통역', x: TREE_X - 400, y: FLOOR_1_Y },
    { id: 'second', title: '2차 프로젝트', subtitle: 'EFY · 매칭 플랫폼 채팅', x: TREE_X - 400, y: FLOOR_2_Y },
    { id: 'main', title: '메인 프로젝트', subtitle: '준비 중', x: TREE_X + 400, y: FLOOR_1_Y },
    { id: 'forest', title: '숲 포트폴리오', subtitle: 'Phaser 4 · React', x: TREE_X + 400, y: FLOOR_2_Y }
];

export const ABOUT_SPOT: SpotDef = { id: 'about', title: '소개', subtitle: 'GitHub · 블로그 · 연락처', x: TREE_X + 300, y: CANOPY_Y };

export const PORTALS = {
    bottom: { x: TREE_X, y: GROUND_Y },
    top: { x: TREE_X - 120, y: CANOPY_Y }
};
