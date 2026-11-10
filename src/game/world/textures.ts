import { Scene } from 'phaser';

type Ctx = CanvasRenderingContext2D;

// 캔버스에 직접 그려서 텍스처를 만든다. 텍스처는 게임 전체가 공유하므로 이미 있으면 다시 그리지 않는다
export function makeTexture (scene: Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void)
{
    if (scene.textures.exists(key))
    {
        return;
    }

    const texture = scene.textures.createCanvas(key, w, h);
    if (!texture)
    {
        return;
    }

    draw(texture.getContext());
    texture.refresh();
}
