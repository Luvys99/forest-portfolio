import { GameObjects, Scene } from 'phaser';
import { Player } from '../objects/Player';

// 위쪽 면만 충돌하는 얇은 판정 (아래에서 점프하면 뚫고 올라가고, 위에서는 밟힌다)
export function addOneWayPlatform (scene: Scene, x1: number, x2: number, y: number)
{
    const w = x2 - x1;
    const zone = scene.add.zone(x1 + w / 2, y + 10, w, 20);
    scene.physics.add.existing(zone, true);

    const body = zone.body as Phaser.Physics.Arcade.StaticBody;
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;

    return zone;
}

// 발판: 위에서 내려올 때만 밟힌다 (사다리 타는 중이거나 ↓ + 점프 중이면 통과)
export function addPlatformCollider (scene: Scene, player: Player, zones: GameObjects.Zone[])
{
    scene.physics.add.collider(
        player.hitbox,
        zones,
        () => player.markOnPlatform(),
        () => !player.passThrough && player.body.velocity.y >= 0
    );
}
