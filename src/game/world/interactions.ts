import { GameObjects, Scene } from 'phaser';
import { Player } from '../objects/Player';

const INTERACT_RANGE = 70;

// ↑ 키로 상호작용할 수 있는 것 (프로젝트 구슬, 포탈, 소개)
interface Interactable
{
    x: number;
    y: number;
    prompt: GameObjects.Text;
    use: () => void;
}

// 가장 가까운 대상에만 안내를 띄우고, ↑ 키로 실행한다
export class Interactions
{
    private items: Interactable[] = [];

    constructor (private scene: Scene) {}

    // (x, y)는 대상이 서 있는 발 위치, promptY는 안내 문구 위치
    add (x: number, y: number, promptText: string, promptY: number, use: () => void)
    {
        const prompt = this.scene.add.text(x, promptY, promptText, {
            fontFamily: 'sans-serif', fontSize: '16px', color: '#fff4c4',
            backgroundColor: 'rgba(10, 30, 40, 0.6)', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(31).setAlpha(0);

        this.items.push({ x, y, prompt, use });
    }

    update (player: Player, enabled: boolean)
    {
        let nearest: Interactable | null = null;
        let nearestDist = INTERACT_RANGE;

        if (enabled && player.onGround)
        {
            for (const item of this.items)
            {
                const dx = Math.abs(player.x - item.x);
                if (dx < nearestDist && Math.abs(player.bottom - item.y) < 30)
                {
                    nearest = item;
                    nearestDist = dx;
                }
            }
        }

        for (const item of this.items)
        {
            const target = item === nearest ? 1 : 0;
            item.prompt.setAlpha(item.prompt.alpha + (target - item.prompt.alpha) * 0.2);
        }

        if (nearest && player.justPressedUp())
        {
            nearest.use();
        }
    }
}
