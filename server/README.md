# 🌳 server: 멀티플레이 중계 서버

숲 포트폴리오의 **멀티플레이 중계 서버**입니다. 게임 화면(저장소 루트, Vite)과 같은 저장소에 두고, 배포만 따로 합니다.
접속한 사람들의 위치를 같은 방 사람들에게 그대로 전달합니다. 물리·충돌·기록은 각자 브라우저가 처리하고, 서버는 판정하지 않습니다.

- Spring Boot 4 · Java 25 · 순수 WebSocket (STOMP 없음, JSON 텍스트 프레임)
- 설계 배경과 단계별 이슈: [#34](https://github.com/Luvys99/forest-portfolio/issues/34)

## 왜 중계만 하나

플레이어끼리 경합하는 요소(밀치기, 선점, 대전)가 없어서 서버가 판정할 분쟁이 없습니다. 좌표를 조작해도 "남에게 이상하게 보이는 것" 외에 얻는 이득이 없습니다.
서버 권위로 가면 클라이언트의 물리(코요테 타임, 점프 버퍼, 사다리)를 서버에 다시 구현하고 예측·보정까지 넣어야 하므로, 이 프로젝트에서는 비용만 들고 얻는 게 없습니다.

## 실행

```bash
cd server
./gradlew bootRun          # http://localhost:8081  (Vite 개발 서버가 8080을 쓰므로 8081)
./gradlew test             # 브라우저 두 개를 흉내 내는 통합 테스트
./gradlew build            # build/libs/forest-relay-server-0.1.0.jar
```

| 경로 | 내용 |
| --- | --- |
| `ws://localhost:8081/ws` | 중계 WebSocket |
| `GET /health` | `{"status":"ok"}` (배포 플랫폼 헬스체크용) |

## 메시지 규약

모든 메시지는 `{"type": "..."}`로 시작하는 JSON입니다.

클라이언트 → 서버

| type | 내용 |
| --- | --- |
| `join` | `name`(1~12자), `color`(hex 6자리), `room`(`forest` \| `sky`). 접속 후 한 번 |
| `move` | `x`, `y`(월드 좌표, y는 발 위치), `facing`(1 \| -1), `state`(`idle` \| `walk` \| `jump` \| `climb`) |
| `room` | `room`, `x`, `y`. 포탈로 다른 맵에 갈 때 |
| `chat` | `text`(1~40자). 말풍선. 세션당 초당 2번까지, 저장하지 않는다 |

서버 → 클라이언트

| type | 받는 사람 | 내용 |
| --- | --- | --- |
| `welcome` | 본인 | `id`(내 세션 id), `room`, `players`(같은 방에 이미 있는 사람들). `join`과 `room` 뒤에 온다 |
| `joined` | 같은 방 | `player` 한 명의 정보 |
| `moved` | 같은 방 | `id`, `x`, `y`, `facing`, `state` |
| `left` | 같은 방 | `id`. 접속 종료 또는 다른 방으로 이동 |
| `chat` | 같은 방 | `id`, `text` |
| `error` | 본인 | `reason`: `invalid_join`, `invalid_room`, `room_full` |

보낸 사람에게는 자기 메시지가 돌아가지 않습니다.

예시는 `src/test/resources/relay-messages.json`에 있습니다. 서버 테스트(`ProtocolExamplesTest`)와 클라이언트 테스트(`client/src/lib/relay.test.ts`)가 같은 파일을 읽으므로, 규약을 바꾸면 양쪽이 같이 깨집니다.

## 배포 (Railway)

`Dockerfile`과 `railway.json`이 빌드·실행·헬스체크 방법을 정해 두었으므로, Railway에서는 저장소를 연결하고 루트 폴더만 지정하면 됩니다.

- 이미지: Gradle로 jar를 만들고 JRE 이미지에서 실행. 플랫폼이 주는 `PORT`로 듣는다 (없으면 8081)
- 메모리: 256MB 제한에서 약 170MB를 쓴다 (로컬 Docker로 측정)
- 헬스체크: `GET /health`
- 공개 도메인의 포트는 앱이 실제로 듣는 포트와 같아야 한다. Railway 는 앱에 `PORT=8080` 을 주므로 도메인도 8080 이다 (Deploy Logs 의 `Tomcat started on port …` 줄로 확인). 다르면 502 `Application failed to respond`
- 주소: `https://forest-portfolio-production.up.railway.app` (`/health`, `/ws`)
- 클라이언트는 `client/.env.production`의 `VITE_RELAY_URL`로 접속한다
- Vercel 프리뷰 주소(`…-git-브랜치-….vercel.app`)는 허용 목록에 없어서 프리뷰에서는 멀티플레이가 꺼진 것처럼 동작한다 (혼자 노는 모드)

로컬에서 컨테이너로 확인:

```bash
docker build -t forest-relay .
docker run -p 8081:8081 forest-relay
```

## 서버가 검사하는 것

서버는 맵을 모르므로 "형식이 맞는가"까지만 봅니다. 어긋난 메시지는 조용히 버리거나 `error`로 답합니다.

- 이름 길이(공백·제어 문자 정리 후 1~12자), 색 형식, 방 이름, 상태 값
- 좌표가 숫자이고 설정된 범위 안인지
- 세션당 `move` 초당 20회, `chat` 초당 2회 초과분은 버림 (클라이언트는 move 15회까지만 보냄)
- 말풍선 글은 이름과 같은 방식으로 정리하고 1~40자
- 방 정원 50명
- 브라우저 `Origin` 헤더가 허용 목록에 있는지 (목록 밖이면 403)

값은 전부 `src/main/resources/application.yml`의 `relay.*`에 있고, 배포 환경에서는 환경변수로 덮어씁니다.

```bash
RELAY_ALLOWED_ORIGINS=https://forest-portfolio-pi.vercel.app,http://localhost:8080
RELAY_ROOM_CAPACITY=50
```

환경변수로 넣은 목록은 기본 목록에 더해지지 않고 **통째로 바뀝니다.** 배포 사이트 주소를 빼먹으면 그 사이트에서 접속이 거부됩니다(403).

## 구조

```
src/main/java/com/olog/forestrelay
├── ForestRelayApplication.java
├── config/
│   ├── RelayProperties.java    relay.* 설정 (허용 Origin, 정원, 빈도, 좌표 범위)
│   └── WebSocketConfig.java    /ws 에 핸들러 등록 + Origin 허용 목록
├── relay/
│   ├── RelayHandler.java       join / move / room 처리와 전달. 중계의 전부
│   ├── RoomRegistry.java       방별 플레이어 목록 (정원 검사와 추가를 방 단위로 잠금)
│   ├── PlayerState.java        세션 하나의 상태 (이름, 색, 방, 마지막 좌표, move 빈도 창)
│   ├── Messages.java           서버 → 클라이언트 메시지 record
│   ├── Validation.java         입력 검사 규칙
│   └── Rooms.java              방 이름 상수
└── web/HealthController.java
```

## 설계에서 고민한 것

- **틱 루프가 없다.** 서버가 시뮬레이션하지 않으므로 메시지가 올 때만 일한다. 상태는 방별 `ConcurrentHashMap`이 전부고, 접속이 끊기면 사라진다.
- **한 세션에 여러 스레드가 동시에 보낸다.** 다른 사람들의 `move`는 각자의 수신 스레드에서 들어오므로, 세션을 `ConcurrentWebSocketSessionDecorator`로 감싸 전송을 직렬화하고, 2초 넘게 못 보내는 세션은 끊는다.
- **정원 검사와 추가는 한 번에.** 두 사람이 동시에 마지막 자리에 들어오지 않도록 방 단위로 잠근다.
- **규칙은 클라이언트와 같게.** 이름 12자 제한은 포트폴리오의 방명록 규칙(`NAME_MAX`)과 같다. 화면에서 걸러도 서버가 다시 본다.
