import { useEffect, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { relay, RelayStatus, Room } from '../lib/relay';

interface Props
{
    // 다른 팝업이 열려 있으면 Enter 로 말풍선을 열지 않는다
    enabled: boolean;
}

interface HudState
{
    active: boolean;
    status: RelayStatus;
    room: Room | null;
    count: number;
}

const ROOM_LABEL: Record<Room, string> = { forest: '🌲 이 숲에', sky: '🌙 밤하늘에' };

function read (): HudState
{
    return {
        active: relay?.active ?? false,
        status: relay?.currentStatus ?? 'offline',
        room: relay?.room ?? null,
        // 같은 방 다른 사람들 + 나
        count: (relay?.players.size ?? 0) + 1
    };
}

// 화면 왼쪽 위: 같은 방 인원, 연결 상태, 말풍선 버튼. 멀티플레이 중일 때만 보인다
export function MultiplayerHud ({ enabled }: Props)
{
    const [ hud, setHud ] = useState(read);

    // 들어오고 나가는 메시지와 연결 상태가 바뀔 때마다 다시 센다
    useEffect(() =>
    {
        if (!relay)
        {
            return;
        }
        const refresh = () => setHud(read());
        const offMessage = relay.onMessage(refresh);
        const offStatus = relay.onStatus(refresh);
        return () =>
        {
            offMessage();
            offStatus();
        };
    }, []);

    // Enter 로 말풍선 입력 (한글 입력 중의 Enter 는 글자 확정이라 무시)
    useEffect(() =>
    {
        if (!enabled || hud.status !== 'online')
        {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) =>
        {
            if (event.key === 'Enter' && !event.isComposing && !event.repeat)
            {
                event.preventDefault();
                EventBus.emit('request-chat');
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [ enabled, hud.status ]);

    if (!hud.active)
    {
        return null;
    }

    const online = hud.status === 'online';

    return (
        <div className="mp-hud" role="status">
            {online && hud.room
                ? <span className="mp-count">{ROOM_LABEL[hud.room]} {hud.count}명</span>
                : <span className="mp-offline">다시 연결하는 중…</span>}
            {online && (
                <button
                    type="button"
                    className="mp-chat-button"
                    aria-label="말풍선 남기기 (Enter)"
                    title="말풍선 남기기 (Enter)"
                    onClick={event =>
                    {
                        // 포커스가 남으면 다음 Space(점프)가 이 버튼을 다시 누른다
                        event.currentTarget.blur();
                        EventBus.emit('request-chat');
                    }}
                >
                    💬
                </button>
            )}
        </div>
    );
}
