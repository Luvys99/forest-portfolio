# 작업 원칙

이 저장소의 코드는 다음 작업의 본보기가 됩니다. 기존 코드의 패턴을 따르되,
따르려는 패턴이 우회 코드나 중복으로 보이면 복제하지 말고 먼저 알려 주세요.

## 문제를 고칠 때
- 증상을 덮지 말고 근본 원인을 고칩니다. sleep, 재시도, 예외 무시, 경고 억제로
  넘어가고 싶어질 때는 멈추고 원인을 설명해 주세요.
- 린트, 타입, 테스트가 실패하면 규칙을 끄거나 테스트를 약하게 만들지 않습니다.
  규칙이 틀렸다고 판단되면 고치기 전에 이유를 말해 주세요.
- 옳은 일을 하지 않은 이유를 주석이나 문서에 적어 두지 않습니다.
  주석은 코드만으로 알 수 없는 사실에만 씁니다.

## 작업을 끝냈다고 말하기 전에
- 빌드와 전체 테스트를 실행하고 결과를 보여 주세요.
- 동작이 바뀌었다면 실제로 실행해 확인한 증거(요청과 응답, 로그, 스크린샷)를 남겨 주세요.
- 확인하지 못한 부분이 있으면 그대로 밝혀 주세요.

## 같은 지적을 다시 받았을 때
- 이 문서에 문장을 추가하기보다, 린트 규칙이나 아키텍처 테스트나 타입으로
  자동 차단할 방법을 먼저 제안해 주세요.

## 명령어
클라이언트(`client/`)와 서버(`server/`)는 따로 빌드합니다. CI(`.github/workflows/ci.yml`)도 같은 명령을 돌립니다.

| | 클라이언트 (`cd client`) | 서버 (`cd server`) |
| --- | --- | --- |
| 빌드 | `npm run build` | `./gradlew build` (테스트 포함) |
| 검사 | `npm run lint`, `npm run typecheck` | 빌드에 포함 |
| 테스트 | `npm test` | `./gradlew test` |
| 로컬 실행 | `npm run dev` → http://localhost:8080 | `./gradlew bootRun` → ws://localhost:8081/ws, `GET /health` |

- 처음 한 번: `cd client && npm install`, 방명록을 쓰려면 `cp .env.example .env.local` 후 Supabase 값 입력
- 작업 흐름: 이슈 만들기 → 브랜치 `feature/#번호-이름` → PR(본문에 `closes #번호`) → CI 통과 후 머지. main에는 직접 푸시하지 않습니다
- 이슈, PR, 커밋 메시지, 주석은 한국어로 씁니다

## 구조
```
client/src/game        Phaser. 씬(scenes), 캐릭터(objects), 맵·텍스처·공용 로직(world), JSON 형식(data)
client/src/components  React 팝업. 공용 Modal 틀 + 프로젝트·소개·방명록
client/src/lib         외부 통신(Supabase REST, 앞으로 중계 서버 WebSocket)과 React·Phaser 양쪽이 쓰는 상수
client/public          projects.json, about.json (내용), 오디오
server/                Spring Boot WebSocket 중계 서버. 좌표를 같은 방 사람들에게 전달만 하고 물리·충돌·기록은 판정하지 않습니다
supabase/              방명록 테이블과 RLS 정책
```
- **Phaser와 React는 `EventBus`로만 대화합니다.** `game/`은 React·components를 import하지 않고, `components/`는 씬·객체·`phaser`를 import하지 않습니다. 이 경계는 ESLint `no-restricted-imports`가 막습니다. React가 `game/`에서 가져와도 되는 것은 데이터 타입(`game/data`), `EventBus`, 순수 유틸뿐입니다.
- **내용은 JSON, 위치는 코드.** 프로젝트 소개는 `public/projects.json`, 맵 좌표는 `game/world/layout.ts`에 두고 id로만 연결합니다.
- **씬은 재사용됩니다.** Phaser는 씬 객체를 다시 쓰므로, 씬에 상태 필드를 추가하면 반드시 `init()`에서 초기화합니다. 빠뜨리면 숲 → 점프맵 → 숲으로 돌아올 때만 드러납니다.
- **같은 규칙이 세 곳에 있습니다.** 이름 12자·한마디 60자 제한은 `client/src/lib/skyRecords.ts`, `supabase/sky_records.sql`, `server/.../Validation.java`에 각각 적혀 있습니다. 하나를 바꾸면 셋 다 바꿉니다. 클라이언트·서버 테스트가 SQL과 대조합니다.
- **물리 상수는 `client/src/game/physics.ts`에 있습니다.** 점프 속도를 바꾸면 점프맵 구름 간격 테스트(`sky-layout.test.ts`)가 클리어 가능 여부를 알려 줍니다.
- **중계 서버 메시지 규약**은 `server/README.md`와 이슈 #34에 있습니다. 클라이언트 타입과 서버 record를 같이 고칩니다.
