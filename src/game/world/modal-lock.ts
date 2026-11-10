import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { Player } from '../objects/Player';

// React 팝업이 열려 있는 동안 캐릭터 조작과 Phaser 키 입력을 멈춘다.
// 팝업이 닫히면 React가 'modal-closed'를 보내고, 그때 다시 푼다
export class ModalLock
{
    isOpen = false;

    constructor (private scene: Scene, private player: Player)
    {
        const onClosed = () => this.set(false);
        EventBus.on('modal-closed', onClosed);
        scene.events.once('shutdown', () => EventBus.off('modal-closed', onClosed));
    }

    // 잠그고 React에 팝업을 열라고 알린다
    open (event: string, data?: unknown)
    {
        this.set(true);
        EventBus.emit(event, data);
    }

    private set (open: boolean)
    {
        this.isOpen = open;
        this.player.locked = open;
        const keyboard = this.scene.input.keyboard!;
        keyboard.enabled = !open;
        // Phaser는 방향키의 기본 동작을 막는다. 팝업의 입력칸에서 방향키로 커서를 옮길 수 있게 잠시 푼다
        if (open)
        {
            keyboard.disableGlobalCapture();
        }
        else
        {
            keyboard.enableGlobalCapture();
        }
        // 팝업을 보는 동안 눌렀던 키가 닫힌 뒤에 눌린 상태로 남지 않게 한다
        keyboard.resetKeys();
    }
}
