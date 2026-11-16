import { describe, expect, it } from 'vitest';
import { Relay, ServerMessage } from './relay';

// 실제 중계 서버에 붙어 보는 테스트. 서버를 띄우고 주소를 주면 돈다:
//   (cd server && ./gradlew bootRun)
//   RELAY_TEST_URL=ws://localhost:8081/ws npm test -- relay.integration
// 주소가 없으면(CI 포함) 건너뛴다. Node 의 내장 WebSocket 을 쓴다
const url = import.meta.env.RELAY_TEST_URL;

function waitFor<T extends ServerMessage['type']> (relay: Relay, type: T, timeoutMs = 3000)
{
    return new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) =>
    {
        const timer = setTimeout(() => reject(new Error(`${type} 을 ${timeoutMs}ms 안에 받지 못했다`)), timeoutMs);
        const off = relay.onMessage(message =>
        {
            if (message.type === type)
            {
                clearTimeout(timer);
                off();
                resolve(message as Extract<ServerMessage, { type: T }>);
            }
        });
    });
}

describe.skipIf(!url)('Relay + 실제 서버', () =>
{
    it('두 클라이언트가 서로의 입장·이동·퇴장을 받는다', async () =>
    {
        const a = new Relay(url!, { now: () => Date.now() });
        const b = new Relay(url!, { now: () => Date.now() });

        const welcomeA = waitFor(a, 'welcome');
        a.connect({ name: '통합A', color: '9dffd8', room: 'forest' });
        expect((await welcomeA).players).toEqual([]);

        const joinedAtA = waitFor(a, 'joined');
        const welcomeB = waitFor(b, 'welcome');
        b.connect({ name: '통합B', color: 'ffaa00', room: 'forest' });
        expect((await welcomeB).players.map(p => p.name)).toEqual([ '통합A' ]);
        expect((await joinedAtA).player.name).toBe('통합B');

        const movedAtA = waitFor(a, 'moved');
        expect(b.sendMove({ x: 120.5, y: 640, facing: -1, state: 'walk' })).toBe(true);
        const moved = await movedAtA;
        expect(moved.id).toBe(b.id);
        expect(moved.x).toBe(120.5);

        const leftAtA = waitFor(a, 'left');
        b.disconnect();
        expect((await leftAtA).id).toBe(moved.id);

        a.disconnect();
    });
});
