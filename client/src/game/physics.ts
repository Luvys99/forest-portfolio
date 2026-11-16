// 중력과 점프 속도. Phaser 설정(main.ts)과 Player가 같이 쓴다.
// Phaser를 import하지 않는 순수 모듈이라 테스트에서 바로 불러올 수 있다.
// 맵 배치(sky-layout.ts)의 구름 간격은 MAX_JUMP_HEIGHT보다 낮아야 한다 (테스트로 지킨다)

export const GRAVITY_Y = 1600;
export const JUMP_VELOCITY = 640;    // 메이플처럼 키를 얼마나 누르든 항상 같은 높이로 뛴다

// 등가속도 운동: 최고 높이 = v² / 2g
export const MAX_JUMP_HEIGHT = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY_Y);
