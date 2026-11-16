import { Cameras, Scene } from 'phaser';

// 화면을 어둡게 한 뒤 다른 씬(맵)으로 넘어간다
export function fadeToScene (scene: Scene, key: string, data?: object)
{
    const cam = scene.cameras.main;
    cam.fadeOut(260, 5, 18, 28);
    cam.once(Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
