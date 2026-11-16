import { Scene } from 'phaser';
import { Relay } from '../../lib/relay';
import { Player } from '../objects/Player';
import { RemotePlayer } from '../objects/RemotePlayer';

// 씬 하나의 멀티플레이: 매 프레임 내 위치를 보내고, 같은 방 사람들을 relay 명단대로 그린다.
// 명단은 relay 가 들고 있어서(씬이 바뀌어도 유지) 이 객체는 명단과 화면을 맞추기만 한다.
// 씬의 create() 에서 새로 만든다. 그림은 씬이 끝날 때 Phaser 가 같이 지운다
export class Multiplayer
{
    private readonly remotes = new Map<string, RemotePlayer>();

    constructor (private readonly scene: Scene, private readonly relay: Relay, private readonly player: Player) {}

    update (time: number, delta: number)
    {
        // 바뀌지 않았거나 너무 잦으면 relay 가 알아서 거른다
        this.relay.sendMove({
            x: Math.round(this.player.x),
            y: Math.round(this.player.bottom),
            facing: this.player.facingDir,
            state: this.player.moveState
        });

        const roster = this.relay.players;
        for (const [ id, remote ] of this.remotes)
        {
            if (!roster.has(id))
            {
                remote.destroy();
                this.remotes.delete(id);
            }
        }
        for (const [ id, info ] of roster)
        {
            let remote = this.remotes.get(id);
            if (!remote)
            {
                remote = new RemotePlayer(this.scene, info);
                this.remotes.set(id, remote);
            }
            remote.setTarget(info);
            remote.update(time, delta);
        }
    }
}
