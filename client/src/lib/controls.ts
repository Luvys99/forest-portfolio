// 화면 터치 버튼(휴대폰)의 눌림 상태. React(TouchControls)가 쓰고 Phaser(Player)가 읽는다.
// 손가락마다 따로 기억해서, 오른쪽을 누른 채 점프를 눌러도 둘 다 눌린 것으로 친다

export type ControlButton = 'left' | 'right' | 'up' | 'down' | 'jump';

export class Controls
{
    // 버튼별로 지금 누르고 있는 손가락(포인터 id)들
    private readonly holders = new Map<ControlButton, Set<number>>();
    // 마지막으로 확인한 뒤 새로 눌렸는지 (점프, 보기처럼 한 번만 반응해야 하는 버튼용)
    private readonly pressed = new Set<ControlButton>();

    press (button: ControlButton, pointerId: number)
    {
        let set = this.holders.get(button);
        if (!set)
        {
            set = new Set();
            this.holders.set(button, set);
        }
        // 이미 다른 손가락이 누르고 있으면 새로 누른 것이 아니다
        if (set.size === 0)
        {
            this.pressed.add(button);
        }
        set.add(pointerId);
    }

    release (button: ControlButton, pointerId: number)
    {
        this.holders.get(button)?.delete(pointerId);
    }

    // 팝업이 열리거나 다른 탭으로 가면 전부 뗀 것으로 친다
    releaseAll ()
    {
        this.holders.clear();
        this.pressed.clear();
    }

    isDown (button: ControlButton)
    {
        return (this.holders.get(button)?.size ?? 0) > 0;
    }

    // 새로 눌렸으면 true 를 한 번만 돌려준다
    consumePressed (button: ControlButton)
    {
        return this.pressed.delete(button);
    }
}

// 게임 전체가 공유하는 하나
export const controls = new Controls();
