import { PointerEvent, useEffect } from 'react';
import { ControlButton, controls } from '../lib/controls';

interface PadButton
{
    button: ControlButton;
    label: string;
    symbol: string;
}

const MOVE: PadButton[] = [
    { button: 'left', label: '왼쪽', symbol: '◀' },
    { button: 'right', label: '오른쪽', symbol: '▶' }
];

const ACTION: PadButton[] = [
    { button: 'up', label: '위 (사다리, 보기, 포탈)', symbol: '▲' },
    { button: 'down', label: '아래 (사다리, 발판 아래로)', symbol: '▼' },
    { button: 'jump', label: '점프', symbol: '점프' }
];

// 휴대폰 화면 버튼. 터치 화면에서만 보인다 (style.css 의 pointer: coarse).
// 손가락을 대면 누르고, 떼거나 화면 밖으로 밀려나면 뗀다. 터치는 브라우저가 처음 닿은 버튼에 계속 묶어 준다
export function TouchControls ()
{
    // 다른 탭으로 가면 떼는 신호를 못 받으므로 전부 뗀 것으로 친다
    useEffect(() =>
    {
        const releaseAll = () => controls.releaseAll();
        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', releaseAll);
        return () =>
        {
            window.removeEventListener('blur', releaseAll);
            document.removeEventListener('visibilitychange', releaseAll);
        };
    }, []);

    const render = ({ button, label, symbol }: PadButton) =>
    {
        const press = (event: PointerEvent<HTMLButtonElement>) =>
        {
            event.preventDefault();
            controls.press(button, event.pointerId);
        };
        const release = (event: PointerEvent<HTMLButtonElement>) => controls.release(button, event.pointerId);

        return (
            <button
                key={button}
                type="button"
                tabIndex={-1}
                className={`touch-button touch-${button}`}
                aria-label={label}
                onPointerDown={press}
                onPointerUp={release}
                onPointerCancel={release}
                onPointerLeave={release}
                onContextMenu={event => event.preventDefault()}
            >
                {symbol}
            </button>
        );
    };

    return (
        <div className="touch-controls" aria-hidden="true">
            <div className="touch-pad">{MOVE.map(render)}</div>
            <div className="touch-pad">{ACTION.map(render)}</div>
        </div>
    );
}
