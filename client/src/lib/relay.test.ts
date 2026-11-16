import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import examples from '../../../server/src/test/resources/relay-messages.json';
import {
    MOVES_PER_SECOND, Move, parseServerMessage, RECONNECT_BASE_MS, RECONNECT_MAX_MS, Relay, RelaySocket, ServerMessage
} from './relay';

// 서버 없이 Relay 의 동작을 본다. 소켓은 가짜이고 시간은 vitest 가짜 타이머로 흘린다
class FakeSocket implements RelaySocket
{
    static all: FakeSocket[] = [];
    sent: string[] = [];
    closed = false;
    onopen: RelaySocket['onopen'] = null;
    onmessage: RelaySocket['onmessage'] = null;
    onclose: RelaySocket['onclose'] = null;
    onerror: RelaySocket['onerror'] = null;

    constructor (readonly url: string)
    {
        FakeSocket.all.push(this);
    }

    send (data: string)
    {
        this.sent.push(data);
    }

    close ()
    {
        this.closed = true;
    }

    // 서버 역할
    serverOpens ()
    {
        this.onopen?.(new Event('open'));
    }

    serverSends (message: unknown)
    {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }));
    }

    serverCloses ()
    {
        this.onclose?.(new CloseEvent('close'));
    }

    last ()
    {
        return JSON.parse(this.sent[this.sent.length - 1]);
    }

    sentJson ()
    {
        return this.sent.map(s => JSON.parse(s));
    }
}

const { join, move, room } = examples.clientToServer;
const { welcome, joined, moved, left, error } = examples.serverToClient;
// JSON 에서 읽은 값은 타입이 넓어지므로(facing: number) Move 로 한 번 옮겨 쓴다. 예시와 같은 값인지는 아래서 확인한다
const MOVE: Move = { x: move.x, y: move.y, facing: -1, state: 'walk' };
// 가짜 타이머는 정수 밀리초만 흘리므로 올림한다
const MOVE_INTERVAL_MS = Math.ceil(1000 / MOVES_PER_SECOND);

function makeRelay ()
{
    const received: ServerMessage[] = [];
    const relay = new Relay('ws://test/ws', { socketFactory: url => new FakeSocket(url), now: () => Date.now() });
    relay.onMessage(m => received.push(m));
    return { relay, received };
}

// 접속해서 welcome 까지 받은 상태
function connected ()
{
    const ctx = makeRelay();
    ctx.relay.connect({ name: join.name, color: join.color, room: 'forest' });
    const socket = FakeSocket.all[0];
    socket.serverOpens();
    socket.serverSends(welcome);
    return { ...ctx, socket };
}

describe('Relay', () =>
{
    beforeEach(() =>
    {
        FakeSocket.all = [];
        vi.useFakeTimers();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() =>
    {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('접속되면 join 을 보내고, welcome 을 받으면 온라인이 되며 내 id 를 안다', () =>
    {
        const { relay, received } = makeRelay();
        const statuses: string[] = [];
        relay.onStatus(s => statuses.push(s));

        relay.connect({ name: join.name, color: join.color, room: 'forest' });
        const socket = FakeSocket.all[0];
        expect(socket.url).toBe('ws://test/ws');
        expect(socket.sent).toEqual([]);                 // 열리기 전에는 아무것도 보내지 않는다

        socket.serverOpens();
        expect(socket.sentJson()).toEqual([ join ]);     // 예시 파일의 join 과 똑같은 모양

        socket.serverSends(welcome);
        expect(relay.id).toBe(welcome.id);
        expect(relay.currentStatus).toBe('online');
        expect(statuses).toEqual([ 'connecting', 'online' ]);
        expect(received).toEqual([ welcome ]);
    });

    it('welcome 전에는 move 를 보내지 않는다', () =>
    {
        const { relay } = makeRelay();
        relay.connect({ name: join.name, color: join.color, room: 'forest' });
        FakeSocket.all[0].serverOpens();

        expect(relay.sendMove(MOVE)).toBe(false);
        expect(FakeSocket.all[0].sentJson()).toEqual([ join ]);
    });

    it('move 는 바뀌었을 때만, 초당 정해진 횟수까지만 나간다', () =>
    {
        const { relay, socket } = connected();
        const a = MOVE;
        const b: Move = { ...a, x: a.x + 10 };

        expect(relay.sendMove(a)).toBe(true);
        expect(socket.last()).toEqual(move);              // 예시 파일의 move 와 똑같은 모양

        expect(relay.sendMove(a)).toBe(false);            // 같은 값은 안 보낸다
        expect(relay.sendMove(b)).toBe(false);            // 바뀌었지만 아직 간격 안

        vi.advanceTimersByTime(MOVE_INTERVAL_MS);
        expect(relay.sendMove(b)).toBe(true);             // 간격이 지나면 마지막 값이 나간다
        expect(socket.sent).toHaveLength(3);              // join + move 2개
    });

    it('방을 옮기면 room 을 보내고, 새 welcome 을 받을 때까지 move 를 멈춘다', () =>
    {
        const { relay, socket } = connected();

        relay.changeRoom('sky', room.x, room.y);
        expect(socket.last()).toEqual(room);              // 예시 파일의 room 과 똑같은 모양
        expect(relay.sendMove(MOVE)).toBe(false);

        socket.serverSends({ ...welcome, room: 'sky', players: [] });
        expect(relay.sendMove(MOVE)).toBe(true);
    });

    it('끊기면 1, 2, 4 … 최대 30초 간격으로 다시 붙고, 붙으면 현재 방으로 다시 join 한다', () =>
    {
        const { relay } = connected();
        relay.changeRoom('sky', 0, 0);

        FakeSocket.all[0].serverCloses();
        expect(relay.currentStatus).toBe('offline');

        let delay = RECONNECT_BASE_MS;
        for (let attempt = 1; attempt <= 7; attempt++)
        {
            vi.advanceTimersByTime(delay - 1);
            expect(FakeSocket.all).toHaveLength(attempt);          // 아직
            vi.advanceTimersByTime(1);
            expect(FakeSocket.all).toHaveLength(attempt + 1);      // 새 소켓
            FakeSocket.all[attempt].serverCloses();                // 또 실패
            delay = Math.min(delay * 2, RECONNECT_MAX_MS);
        }
        expect(delay).toBe(RECONNECT_MAX_MS);

        vi.advanceTimersByTime(RECONNECT_MAX_MS);
        const socket = FakeSocket.all[FakeSocket.all.length - 1];
        socket.serverOpens();
        expect(socket.sentJson()).toEqual([ { ...join, room: 'sky' } ]);

        // 성공하면 간격이 처음으로 돌아간다
        socket.serverSends({ ...welcome, room: 'sky' });
        socket.serverCloses();
        vi.advanceTimersByTime(RECONNECT_BASE_MS);
        expect(FakeSocket.all[FakeSocket.all.length - 1]).not.toBe(socket);
    });

    it('서버가 입장을 거절하면(room_full) 다시 붙지 않는다', () =>
    {
        const { relay, received } = makeRelay();
        relay.connect({ name: join.name, color: join.color, room: 'forest' });
        const socket = FakeSocket.all[0];
        socket.serverOpens();
        socket.serverSends(error);
        socket.serverCloses();

        vi.advanceTimersByTime(RECONNECT_MAX_MS * 2);
        expect(FakeSocket.all).toHaveLength(1);
        expect(received).toEqual([ error ]);
        expect(relay.currentStatus).toBe('offline');
    });

    it('disconnect 하면 소켓을 닫고 다시 붙지 않으며, 다시 connect 할 수 있다', () =>
    {
        const { relay, socket } = connected();

        relay.disconnect();
        expect(socket.closed).toBe(true);
        expect(relay.id).toBeNull();
        vi.advanceTimersByTime(RECONNECT_MAX_MS * 2);
        expect(FakeSocket.all).toHaveLength(1);

        relay.connect({ name: join.name, color: join.color, room: 'forest' });
        expect(FakeSocket.all).toHaveLength(2);
    });

    it('이미 접속 중이면 connect 를 다시 불러도 소켓을 하나 더 만들지 않는다', () =>
    {
        const { relay } = connected();
        relay.connect({ name: '다른이름', color: join.color, room: 'forest' });
        expect(FakeSocket.all).toHaveLength(1);
    });
});

describe('parseServerMessage', () =>
{
    it('예시 파일의 서버 메시지를 전부 읽는다', () =>
    {
        for (const [ type, example ] of Object.entries(examples.serverToClient))
        {
            const parsed = parseServerMessage(JSON.stringify(example));
            expect(parsed, type).toEqual(example);
        }
    });

    it('모양이 다르면 버린다', () =>
    {
        expect(parseServerMessage('not json')).toBeNull();
        expect(parseServerMessage('{"type":"attack"}')).toBeNull();
        expect(parseServerMessage(JSON.stringify({ ...moved, facing: 0 }))).toBeNull();
        expect(parseServerMessage(JSON.stringify({ ...moved, state: 'fly' }))).toBeNull();
        expect(parseServerMessage(JSON.stringify({ ...welcome, room: 'cave' }))).toBeNull();
        expect(parseServerMessage(JSON.stringify({ ...joined, player: { ...joined.player, id: 7 } }))).toBeNull();
        expect(parseServerMessage(JSON.stringify({ ...left, id: undefined }))).toBeNull();
        expect(parseServerMessage(JSON.stringify({ type: 'error', reason: 'teapot' }))).toBeNull();
    });
});
