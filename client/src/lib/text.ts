// 사람이 입력한 짧은 글(이름, 말풍선)을 다듬는다. 서버 Validation.cleanText 와 같은 규칙:
// 제어 문자 제거 → 앞뒤 공백 제거 → 1~max 자. 어긋나면 null
export function cleanText (raw: string, max: number): string | null
{
    const cleaned = raw.replace(/\p{Cc}/gu, '').trim();
    if (cleaned.length === 0 || cleaned.length > max)
    {
        return null;
    }
    return cleaned;
}
