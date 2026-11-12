import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

// 배경음악 정보 (출처 표기는 소개 팝업과 README에도 같이 보여 준다)
export const BGM = {
    src: 'audio/forest-night.mp3',
    title: '숲의 밤',
    credit: 'Claude로 제작'
};

const STORAGE_KEY = 'forest-portfolio:bgm-on';
const VOLUME = 0.4;
const FADE_MS = 800;

// 기본은 켜짐. 방문자가 직접 끈 적이 있을 때만 꺼진 상태로 시작한다
// 브라우저 저장소는 막혀 있을 수 있어서 실패해도 동작은 그대로 둔다
function loadOn ()
{
    try
    {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    }
    catch
    {
        return true;
    }
}

function saveOn (on: boolean)
{
    try
    {
        localStorage.setItem(STORAGE_KEY, String(on));
    }
    catch
    {
        // 기억하지 못해도 이번 방문에서는 동작한다
    }
}

// 화면 구석의 🔊 버튼. 들어오자마자 재생을 시도한다.
// 브라우저가 자동 재생을 막으면 첫 키 입력이나 클릭 때 바로 재생을 시작한다.
export function BgmToggle ()
{
    const audio = useRef<HTMLAudioElement>(null);
    const fadeTimer = useRef<number | null>(null);
    const [ on, setOn ] = useState(loadOn);

    // 볼륨을 천천히 올리거나 내린다
    const fadeTo = useCallback((target: number, done?: () => void) =>
    {
        const el = audio.current;
        if (!el)
        {
            return;
        }
        if (fadeTimer.current !== null)
        {
            clearInterval(fadeTimer.current);
        }

        const steps = 20;
        const step = (target - el.volume) / steps;
        let count = 0;
        fadeTimer.current = window.setInterval(() =>
        {
            count++;
            el.volume = Math.min(1, Math.max(0, el.volume + step));
            if (count >= steps)
            {
                clearInterval(fadeTimer.current!);
                fadeTimer.current = null;
                el.volume = target;
                done?.();
            }
        }, FADE_MS / steps);
    }, []);

    const play = useCallback(() =>
    {
        const el = audio.current;
        if (!el || !el.paused)
        {
            return;
        }
        el.volume = 0;
        el.play().then(() => fadeTo(VOLUME)).catch(() =>
        {
            // 아직 사용자 입력 전이면 재생이 막힌다. 아래의 첫 입력 리스너가 다시 시도한다
        });
    }, [ fadeTo ]);

    const pause = useCallback(() =>
    {
        const el = audio.current;
        if (!el || el.paused)
        {
            return;
        }
        fadeTo(0, () => el.pause());
    }, [ fadeTo ]);

    // 켜짐 상태를 따른다. 자동 재생이 막히면 첫 키 입력이나 클릭 때 재생을 시작한다
    useEffect(() =>
    {
        if (!on)
        {
            pause();
            return;
        }

        play();
        const startOnFirstInput = () => play();
        window.addEventListener('keydown', startOnFirstInput, { once: true });
        window.addEventListener('pointerdown', startOnFirstInput, { once: true });
        return () =>
        {
            window.removeEventListener('keydown', startOnFirstInput);
            window.removeEventListener('pointerdown', startOnFirstInput);
        };
    }, [ on, play, pause ]);

    // 다른 탭으로 가면 멈추고, 돌아오면 다시 튼다
    useEffect(() =>
    {
        const onVisibility = () =>
        {
            if (document.hidden)
            {
                audio.current?.pause();
            }
            else if (on)
            {
                play();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [ on, play ]);

    const toggle = (event: MouseEvent<HTMLButtonElement>) =>
    {
        // 버튼에 포커스가 남으면 다음 Space(점프)가 버튼을 다시 눌러 버린다
        event.currentTarget.blur();
        const next = !on;
        setOn(next);
        saveOn(next);
    };

    return (
        <>
            <audio ref={audio} src={BGM.src} loop preload="auto" />
            <button
                className="bgm-toggle"
                onClick={toggle}
                aria-label={on ? '배경음악 끄기' : '배경음악 켜기'}
                aria-pressed={on}
                title={`배경음악: ${BGM.title} (${BGM.credit})`}
            >
                {on ? '🔊' : '🔇'}
            </button>
        </>
    );
}
