// 카카오톡 안의 브라우저(인앱 브라우저)로 열리면 위아래 카카오 막대 때문에 게임 화면이 거의 안 보인다.
// 카카오톡은 kakaotalk://web/openExternal?url=… 로 이동하면 그 주소를 기기의 기본 브라우저로 연다

// 카카오톡 안에서 열렸으면 외부 브라우저로 여는 주소, 아니면 null
export function externalBrowserUrl (userAgent: string, href: string): string | null
{
    if (!/KAKAOTALK/i.test(userAgent))
    {
        return null;
    }
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
}
