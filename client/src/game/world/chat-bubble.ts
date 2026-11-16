import { GameObjects, Scene } from 'phaser';

const DEPTH = 32;
const WRAP_WIDTH = 220;

// 머리 위 말풍선. 보여 줄 글이 없으면 숨는다 (글과 보이는 시간은 relay 가 정한다)
export class ChatBubble
{
    private readonly text: GameObjects.Text;

    constructor (scene: Scene)
    {
        this.text = scene.add.text(0, 0, '', {
            fontFamily: 'sans-serif', fontSize: '15px', color: '#0a2430', align: 'center',
            backgroundColor: 'rgba(255, 246, 214, 0.92)', padding: { x: 10, y: 6 },
            wordWrap: { width: WRAP_WIDTH, useAdvancedWrap: true }
        }).setOrigin(0.5, 1).setDepth(DEPTH).setVisible(false);
    }

    // (x, bottomY) 는 말풍선 아래쪽 가운데
    show (message: string | null, x: number, bottomY: number)
    {
        if (message === null)
        {
            this.text.setVisible(false);
            return;
        }
        if (this.text.text !== message)
        {
            this.text.setText(message);
        }
        this.text.setPosition(x, bottomY).setVisible(true);
    }

    destroy ()
    {
        this.text.destroy();
    }
}
