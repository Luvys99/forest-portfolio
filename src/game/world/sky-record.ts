// 점프맵 최고 기록 (브라우저 localStorage, 서버 없음)
// 숲의 포탈 안내와 점프맵 타이머가 같이 쓴다

const BEST_KEY = 'forest-portfolio:sky-best';

// 브라우저 저장소는 사생활 보호 모드 등에서 막혀 있을 수 있어서 실패해도 게임은 계속된다
export function loadBest (): number | null
{
    try
    {
        const value = Number(localStorage.getItem(BEST_KEY));
        return value > 0 ? value : null;
    }
    catch
    {
        return null;
    }
}

export function saveBest (ms: number)
{
    try
    {
        localStorage.setItem(BEST_KEY, String(ms));
    }
    catch
    {
        // 저장이 안 돼도 이번 판 기록은 화면에 보여 준다
    }
}

// 83456 → "1:23.45"
export function formatTime (ms: number)
{
    const total = ms / 1000;
    const min = Math.floor(total / 60);
    const sec = (total % 60).toFixed(2).padStart(5, '0');
    return `${min}:${sec}`;
}
