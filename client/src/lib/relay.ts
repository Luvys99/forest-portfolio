// 멀티플레이 중계 서버 연결 (server/ 폴더의 Spring Boot WebSocket)
// 서버는 받은 좌표를 같은 방 사람들에게 그대로 전달만 한다. 물리·충돌은 각자 브라우저가 처리한다.
// 메시지 규약은 server/README.md, 예시는 server/src/test/resources/relay-messages.json (양쪽 테스트가 같이 읽는다)

import { cleanText } from './text';

const URL = import.meta.env.VITE_RELAY_URL;

export const RELAY_URL = URL;
// 설정이 없으면 멀티플레이 없이 지금처럼 혼자 노는 모드 (방명록의 guestbookEnabled와 같은 방식)
export const multiplayerEnabled = Boolean(URL);

export type Room = 'forest' | 'sky';
export type PlayerState = 'idle' | 'walk' | 'jump' | 'climb';
export type Facing = 1 | -1;

export interface Move
{
    // 월드 좌표 (픽셀). y 는 발 위치
    x: number;
    y: number;
    facing: Facing;
    state: PlayerState;
}

export interface RemotePlayer extends Move
{
    id: string;
    name: string;
    color: string;
}

// join 할 때 보내는 내 정보. 재접속 때도 그대로 다시 보낸다
export interface Profile
{
    name: string;
    color: string;
    room: Room;
}

export type ClientMessage =
    | ({ type: 'join' } & Profile)
    | ({ type: 'move' } & Move)
    | { type: 'room'; room: Room; x: number; y: number }
    | { type: 'chat'; text: string };

export type ErrorReason = 'invalid_join' | 'invalid_room' | 'room_full';

export type ServerMessage =
    | { type: 'welcome'; id: string; room: Room; players: RemotePlayer[] }
    | { type: 'joined'; player: RemotePlayer }
    | ({ type: 'moved'; id: string } & Move)
    | { type: 'left'; id: string }
    | { type: 'chat'; id: string; text: string }
    | { type: 'error'; reason: ErrorReason };

export type RelayStatus = 'offline' | 'connecting' | 'online';

// 초당 최대 전송 횟수. 서버는 20회까지 받으므로 여유를 둔다
export const MOVES_PER_SECOND = 15;
const MOVE_INTERVAL_MS = 1000 / MOVES_PER_SECOND;
// 말풍선: 최대 글자 수(서버 Validation.CHAT_MAX 와 같다), 보이는 시간, 연속으로 보낼 수 있는 간격(서버는 초당 2번까지)
export const CHAT_MAX = 40;
export const CHAT_SHOW_MS = 4000;
const CHAT_INTERVAL_MS = 500;
// 끊기면 1초 → 2초 → 4초 … 최대 30초 간격으로 다시 붙는다
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30_000;

const ROOMS: readonly string[] = [ 'forest', 'sky' ];
const STATES: readonly string[] = [ 'idle', 'walk', 'jump', 'climb' ];
const ERROR_REASONS: readonly string[] = [ 'invalid_join', 'invalid_room', 'room_full' ];

// 브라우저 WebSocket 중 쓰는 부분만. 테스트에서는 가짜 소켓을 넣는다
export interface RelaySocket
{
    send (data: string): void;
    close (): void;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
}

export interface RelayOptions
{
    socketFactory?: (url: string) => RelaySocket;
    now?: () => number;
}

type MessageListener = (message: ServerMessage) => void;
type StatusListener = (status: RelayStatus) => void;

export class Relay
{
    private readonly socketFactory: (url: string) => RelaySocket;
    private readonly now: () => number;

    private socket: RelaySocket | null = null;
    private profile: Profile | null = null;
    // disconnect() 했거나 서버가 거절(room_full 등)했으면 다시 붙지 않는다
    private stopped = true;
    // welcome 을 받은 뒤부터 move 를 보낸다
    private joined = false;
    private myId: string | null = null;
    private status: RelayStatus = 'offline';

    private reconnectDelay = RECONNECT_BASE_MS;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    private lastMove: Move | null = null;
    private lastMoveAt = -Infinity;
    // 탭이 뒤로 가 있는 동안은 보내지 않는다
    private hidden = false;

    // 지금 같은 방에 있는 다른 사람들 (나는 없다). 씬은 매 프레임 이 명단대로 그린다
    private readonly roster = new Map<string, RemotePlayer>();
    // 사람별 마지막 말풍선 (내 것 포함). 보일지는 시각으로 정한다
    private readonly chats = new Map<string, { text: string; at: number }>();
    private lastChatAt = -Infinity;

    private readonly messageListeners = new Set<MessageListener>();
    private readonly statusListeners = new Set<StatusListener>();
    private readonly onVisibilityChange = () => this.setHidden(document.hidden);

    constructor (private readonly url: string, options: RelayOptions = {})
    {
        this.socketFactory = options.socketFactory ?? (u => new WebSocket(u));
        this.now = options.now ?? (() => performance.now());
    }

    get id ()
    {
        return this.myId;
    }

    get currentStatus ()
    {
        return this.status;
    }

    get isJoined ()
    {
        return this.joined;
    }

    // 입장했고 아직 끊지 않았는지 (재접속 중도 포함). 혼자 둘러보기나 거절당한 뒤면 false
    get active ()
    {
        return !this.stopped;
    }

    get players (): ReadonlyMap<string, Readonly<RemotePlayer>>
    {
        return this.roster;
    }

    // 지금 있는 방 (입장 전이면 null)
    get room (): Room | null
    {
        return this.profile?.room ?? null;
    }

    // 그 사람의 말풍선이 지금 보여야 하면 글, 아니면 null. id 가 null 이면 null
    activeChat (id: string | null): string | null
    {
        const chat = id === null ? undefined : this.chats.get(id);
        return chat && this.now() - chat.at < CHAT_SHOW_MS ? chat.text : null;
    }

    // 말풍선 보내기. 내 말풍선도 바로 보인다. 입장 전, 빈 글, 너무 긴 글, 0.5초 안의 연속은 보내지 않고 false
    sendChat (raw: string)
    {
        const text = cleanText(raw, CHAT_MAX);
        const now = this.now();
        if (!this.joined || this.myId === null || text === null || now - this.lastChatAt < CHAT_INTERVAL_MS)
        {
            return false;
        }
        this.lastChatAt = now;
        this.chats.set(this.myId, { text, at: now });
        this.send({ type: 'chat', text });
        return true;
    }

    onMessage (listener: MessageListener)
    {
        this.messageListeners.add(listener);
        return () => this.messageListeners.delete(listener);
    }

    onStatus (listener: StatusListener)
    {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    // 접속하고 join 한다. 이미 접속 중이면 아무것도 하지 않는다 (React 개발 모드의 이중 마운트 대비)
    connect (profile: Profile)
    {
        if (!this.stopped)
        {
            return;
        }
        this.profile = profile;
        this.stopped = false;
        this.reconnectDelay = RECONNECT_BASE_MS;

        if (typeof document !== 'undefined')
        {
            this.hidden = document.hidden;
            document.addEventListener('visibilitychange', this.onVisibilityChange);
        }
        this.open();
    }

    // 접속을 끊고 다시 붙지 않는다
    disconnect ()
    {
        this.stopped = true;
        this.clearReconnect();
        if (typeof document !== 'undefined')
        {
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
        }
        const socket = this.socket;
        this.socket = null;
        this.joined = false;
        this.myId = null;
        this.roster.clear();
        this.chats.clear();
        if (socket)
        {
            socket.onclose = null;
            socket.close();
        }
        this.setStatus('offline');
    }

    // 내 위치. 매 프레임 불러도 되고, 실제로는 초당 MOVES_PER_SECOND 번까지만, 바뀌었을 때만 나간다.
    // 보냈으면 true
    sendMove (move: Move)
    {
        if (!this.joined || this.hidden)
        {
            return false;
        }
        if (this.lastMove && sameMove(this.lastMove, move))
        {
            return false;
        }
        const now = this.now();
        if (now - this.lastMoveAt < MOVE_INTERVAL_MS)
        {
            return false;
        }
        this.lastMove = { ...move };
        this.lastMoveAt = now;
        this.send({ type: 'move', ...move });
        return true;
    }

    // 포탈로 다른 맵에 갈 때. 서버가 새 방의 welcome 을 다시 보내 줄 때까지 move 는 나가지 않는다
    changeRoom (room: Room, x: number, y: number)
    {
        if (!this.profile || this.profile.room === room)
        {
            return;
        }
        this.profile = { ...this.profile, room };
        this.lastMove = null;
        if (!this.joined)
        {
            return; // 재접속 중이면 join 때 새 방으로 들어간다
        }
        this.joined = false;
        this.roster.clear();
        this.chats.clear();
        this.send({ type: 'room', room, x, y });
    }

    // ---- 내부 ----

    private open ()
    {
        if (!this.profile)
        {
            return;
        }
        this.setStatus('connecting');
        const socket = this.socketFactory(this.url);
        this.socket = socket;

        socket.onopen = () =>
        {
            if (this.socket !== socket)
            {
                return;
            }
            this.reconnectDelay = RECONNECT_BASE_MS;
            this.send({ type: 'join', ...this.profile! });
        };

        socket.onmessage = event =>
        {
            if (this.socket !== socket || typeof event.data !== 'string')
            {
                return;
            }
            const message = parseServerMessage(event.data);
            if (message)
            {
                this.receive(message);
            }
        };

        socket.onerror = () =>
        {
            // 브라우저는 error 뒤에 close 를 보내므로 뒤처리는 onclose 에서 한다
        };

        socket.onclose = () =>
        {
            if (this.socket !== socket)
            {
                return;
            }
            this.socket = null;
            this.joined = false;
            this.roster.clear();
            this.chats.clear();
            this.setStatus('offline');
            if (this.stopped)
            {
                return;
            }
            console.warn(`중계 서버 연결이 끊겼습니다. ${this.reconnectDelay / 1000}초 뒤 다시 시도합니다`);
            this.scheduleReconnect();
        };
    }

    private receive (message: ServerMessage)
    {
        switch (message.type)
        {
            case 'welcome':
                this.myId = message.id;
                this.joined = true;
                this.lastMove = null;
                this.lastMoveAt = -Infinity;
                // 방에 들어갈 때마다 명단을 통째로 바꾼다 (재접속, 방 이동 포함)
                this.roster.clear();
                this.chats.clear();
                for (const player of message.players)
                {
                    this.roster.set(player.id, { ...player });
                }
                this.setStatus('online');
                break;
            case 'joined':
                this.roster.set(message.player.id, { ...message.player });
                break;
            case 'moved':
            {
                const player = this.roster.get(message.id);
                if (player)
                {
                    player.x = message.x;
                    player.y = message.y;
                    player.facing = message.facing;
                    player.state = message.state;
                }
                break;
            }
            case 'left':
                this.roster.delete(message.id);
                this.chats.delete(message.id);
                break;
            case 'chat':
                if (this.roster.has(message.id))
                {
                    this.chats.set(message.id, { text: message.text, at: this.now() });
                }
                break;
            case 'error':
                // 방이 꽉 찼거나 join 이 거절되면 서버가 연결을 끊는다. 같은 요청으로 다시 붙어 봐야 같은 결과다
                if (message.reason === 'room_full' || message.reason === 'invalid_join')
                {
                    console.warn(`중계 서버가 입장을 거절했습니다: ${message.reason}`);
                    this.stopped = true;
                }
                break;
        }
        for (const listener of this.messageListeners)
        {
            listener(message);
        }
    }

    private scheduleReconnect ()
    {
        this.clearReconnect();
        this.reconnectTimer = setTimeout(() =>
        {
            this.reconnectTimer = null;
            if (!this.stopped)
            {
                this.open();
            }
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    }

    private clearReconnect ()
    {
        if (this.reconnectTimer !== null)
        {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private setHidden (hidden: boolean)
    {
        this.hidden = hidden;
        if (!hidden)
        {
            // 돌아오자마자 지금 위치를 보낼 수 있게 간격 제한을 푼다
            this.lastMoveAt = -Infinity;
        }
    }

    private send (message: ClientMessage)
    {
        this.socket?.send(JSON.stringify(message));
    }

    private setStatus (status: RelayStatus)
    {
        if (this.status === status)
        {
            return;
        }
        this.status = status;
        for (const listener of this.statusListeners)
        {
            listener(status);
        }
    }
}

// 게임 전체가 공유하는 연결 하나. 씬이 바뀌어도 유지된다. 설정이 없으면 null (멀티플레이 없음)
export const relay: Relay | null = URL ? new Relay(URL) : null;

function sameMove (a: Move, b: Move)
{
    return a.x === b.x && a.y === b.y && a.facing === b.facing && a.state === b.state;
}

// 서버가 보낸 문자열을 ServerMessage 로. 모양이 다르면 null (조용히 버린다)
export function parseServerMessage (text: string): ServerMessage | null
{
    let raw: unknown;
    try
    {
        raw = JSON.parse(text);
    }
    catch
    {
        return null;
    }
    if (!isRecord(raw) || typeof raw.type !== 'string')
    {
        return null;
    }

    switch (raw.type)
    {
        case 'welcome':
            if (typeof raw.id === 'string' && isRoom(raw.room) && Array.isArray(raw.players) && raw.players.every(isRemotePlayer))
            {
                return { type: 'welcome', id: raw.id, room: raw.room, players: raw.players };
            }
            return null;
        case 'joined':
            return isRemotePlayer(raw.player) ? { type: 'joined', player: raw.player } : null;
        case 'moved':
            return typeof raw.id === 'string' && isMove(raw) ? { type: 'moved', id: raw.id, x: raw.x, y: raw.y, facing: raw.facing, state: raw.state } : null;
        case 'left':
            return typeof raw.id === 'string' ? { type: 'left', id: raw.id } : null;
        case 'chat':
            return typeof raw.id === 'string' && typeof raw.text === 'string' ? { type: 'chat', id: raw.id, text: raw.text } : null;
        case 'error':
            return typeof raw.reason === 'string' && ERROR_REASONS.includes(raw.reason) ? { type: 'error', reason: raw.reason as ErrorReason } : null;
        default:
            return null;
    }
}

function isRecord (value: unknown): value is Record<string, unknown>
{
    return typeof value === 'object' && value !== null;
}

function isRoom (value: unknown): value is Room
{
    return typeof value === 'string' && ROOMS.includes(value);
}

function isMove (value: unknown): value is Move
{
    return isRecord(value)
        && typeof value.x === 'number' && Number.isFinite(value.x)
        && typeof value.y === 'number' && Number.isFinite(value.y)
        && (value.facing === 1 || value.facing === -1)
        && typeof value.state === 'string' && STATES.includes(value.state);
}

function isRemotePlayer (value: unknown): value is RemotePlayer
{
    return isMove(value) && isRecord(value)
        && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.color === 'string';
}
