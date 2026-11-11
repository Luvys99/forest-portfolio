import { useLayoutEffect, useRef } from 'react';
import StartGame from './game/main';

// React 화면 안에 Phaser 게임을 붙인다.
// React와 게임은 서로를 직접 부르지 않고 EventBus로만 신호를 주고받는다.
export function PhaserGame ()
{
    const game = useRef<Phaser.Game | null>(null);

    useLayoutEffect(() =>
    {
        if (game.current === null)
        {
            game.current = StartGame('game-container');
        }

        // React 개발 모드(StrictMode)는 컴포넌트를 만들었다 지우고 다시 만들므로, 지울 때 게임도 정리한다
        return () =>
        {
            game.current?.destroy(true);
            game.current = null;
        };
    }, []);

    return (
        <div id="game-container"></div>
    );
}
