// 휴대폰을 세로로 들고 있으면 가로로 돌려 달라고 안내한다 (게임 화면이 가로 1280×720).
// 보일지는 style.css 의 미디어 쿼리가 정한다 (터치 화면 + 세로)
export function RotateHint ()
{
    return (
        <div className="rotate-hint" role="status">
            <div className="rotate-hint-phone">📱</div>
            <p>휴대폰을 가로로 돌려 주세요</p>
            <p className="rotate-hint-sub">숲은 가로 화면에서 걸어 다닐 수 있어요</p>
        </div>
    );
}
