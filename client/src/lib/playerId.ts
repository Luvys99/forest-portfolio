// 순위표에서 "같은 사람"을 가르는 브라우저 id. 로그인이 없으므로 브라우저마다 한 사람으로 센다.
// localStorage 에 두어 탭을 닫아도 남는다. 다른 기기나 브라우저 데이터를 지우면 새 사람이 된다 (#59)

const STORAGE_KEY = 'forest-portfolio:player-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 저장소가 막혀 있으면 이번 접속 동안만 쓴다
let fallback: string | null = null;

export function getPlayerId (): string
{
    try
    {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && UUID.test(saved))
        {
            return saved;
        }
        const created = randomUuid();
        localStorage.setItem(STORAGE_KEY, created);
        return created;
    }
    catch
    {
        fallback ??= randomUuid();
        return fallback;
    }
}

// crypto.randomUUID 는 https·localhost 에서만 있다. 휴대폰으로 http://192.168.x.x 개발 서버에 붙을 때도 되도록 직접 만든다
function randomUuid ()
{
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
