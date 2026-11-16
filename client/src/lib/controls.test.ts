import { describe, expect, it } from 'vitest';
import { Controls } from './controls';

describe('Controls', () =>
{
    it('누르고 있는 동안만 눌린 상태다', () =>
    {
        const c = new Controls();
        expect(c.isDown('left')).toBe(false);
        c.press('left', 1);
        expect(c.isDown('left')).toBe(true);
        c.release('left', 1);
        expect(c.isDown('left')).toBe(false);
    });

    it('오른쪽을 누른 채 점프를 눌러도 둘 다 눌린 상태다 (손가락마다 따로)', () =>
    {
        const c = new Controls();
        c.press('right', 1);
        c.press('jump', 2);
        expect(c.isDown('right')).toBe(true);
        expect(c.isDown('jump')).toBe(true);
        c.release('jump', 2);
        expect(c.isDown('right')).toBe(true);
    });

    it('같은 버튼을 두 손가락이 누르면, 둘 다 떼야 뗀 것이다', () =>
    {
        const c = new Controls();
        c.press('left', 1);
        c.press('left', 2);
        c.release('left', 1);
        expect(c.isDown('left')).toBe(true);
        c.release('left', 2);
        expect(c.isDown('left')).toBe(false);
    });

    it('새로 누른 것은 한 번만 알려 주고, 누르고 있다고 다시 알려 주지 않는다', () =>
    {
        const c = new Controls();
        c.press('jump', 1);
        expect(c.consumePressed('jump')).toBe(true);
        expect(c.consumePressed('jump')).toBe(false);
        c.press('jump', 2);                         // 이미 누르고 있는 버튼에 손가락 하나 더
        expect(c.consumePressed('jump')).toBe(false);
        c.release('jump', 1);
        c.release('jump', 2);
        c.press('jump', 3);                         // 뗐다가 다시 누르면 새로 누른 것
        expect(c.consumePressed('jump')).toBe(true);
    });

    it('전부 떼면 눌린 것도, 아직 확인 안 한 새 누름도 사라진다', () =>
    {
        const c = new Controls();
        c.press('up', 1);
        c.press('left', 2);
        c.releaseAll();
        expect(c.isDown('left')).toBe(false);
        expect(c.consumePressed('up')).toBe(false);
        c.release('left', 2);                       // 이미 뗀 손가락을 다시 떼도 문제없다
        expect(c.isDown('left')).toBe(false);
    });
});
