import { GameObjects, Scene } from 'phaser';
import { Player } from '../objects/Player';
import { LadderDef } from './layout';
import { ModalLock } from './modal-lock';
import { addPlatformCollider } from './platforms';

export interface SpawnOptions
{
    worldW: number;
    groundY: number;
    // 시작 발 위치
    feet: { x: number; y: number };
    platforms: GameObjects.Zone[];
    ladders?: LadderDef[];
    // 카메라가 세로로 따라오는 빠르기와, 캐릭터가 이 안에서 움직이면 카메라가 가만히 있는 영역
    follow: { lerpY: number; deadzone: [ number, number ] };
}

// 캐릭터가 있는 씬(숲, 점프맵)의 공통 준비: 땅 판정, 캐릭터, 발판 충돌, 팝업 잠금, 카메라 따라가기
export function spawnPlayer (scene: Scene, options: SpawnOptions)
{
    const { worldW, groundY, feet, platforms, ladders = [], follow } = options;

    const ground = scene.add.zone(worldW / 2, groundY + 50, worldW, 100);
    scene.physics.add.existing(ground, true);

    const player = new Player(scene, feet.x, feet.y - 40);
    player.ladders = ladders;
    scene.physics.add.collider(player.hitbox, ground);
    addPlatformCollider(scene, player, platforms);

    const modal = new ModalLock(scene, player);

    const cam = scene.cameras.main;
    cam.startFollow(player.hitbox, true, 0.08, follow.lerpY);
    cam.setDeadzone(follow.deadzone[0], follow.deadzone[1]);

    return { player, modal };
}
