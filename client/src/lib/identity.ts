// 멀티플레이에서 남에게 보일 내 정보 (이름, 정령 색).
// 브라우저 sessionStorage 에만 두어 새로고침 때 다시 묻지 않는다. 탭을 닫으면 사라진다 (로그인 없음).
// 세션 id 는 서버가 welcome 으로 준다 (relay.ts)

import { NAME_MAX } from './skyRecords';

export interface Identity
{
    name: string;
    // hex 6자리, '#' 없이 소문자 (서버 Validation.color 와 같은 형식)
    color: string;
}

export interface PaletteColor
{
    hex: string;
    label: string;
}

// 고를 수 있는 정령 색. 첫 번째가 기본값이고 지금 캐릭터 글로우 색과 같다
export const PALETTE: readonly PaletteColor[] = [
    { hex: '9dffd8', label: '민트' },
    { hex: 'ffd34d', label: '황금' },
    { hex: 'ffa0c8', label: '분홍' },
    { hex: '9fd8ff', label: '하늘' },
    { hex: 'c9b8ff', label: '보라' },
    { hex: 'b6ff8a', label: '연두' }
];

const STORAGE_KEY = 'forest-portfolio:identity';

// 서버(Validation.name)와 같은 규칙: 제어 문자 제거, 앞뒤 공백 제거, 1~NAME_MAX 자. 어긋나면 null
export function normalizeName (raw: string): string | null
{
    const cleaned = raw.replace(/\p{Cc}/gu, '').trim();
    if (cleaned.length === 0 || cleaned.length > NAME_MAX)
    {
        return null;
    }
    return cleaned;
}

export function isPaletteColor (hex: string)
{
    return PALETTE.some(c => c.hex === hex);
}

// 저장된 값이 없거나, 저장소가 막혀 있거나, 규칙에 어긋나면 null (다시 묻는다)
export function loadIdentity (): Identity | null
{
    try
    {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw)
        {
            return null;
        }
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null)
        {
            return null;
        }
        const { name, color } = parsed as Record<string, unknown>;
        if (typeof name !== 'string' || typeof color !== 'string')
        {
            return null;
        }
        const normalized = normalizeName(name);
        if (!normalized || !isPaletteColor(color))
        {
            return null;
        }
        return { name: normalized, color };
    }
    catch
    {
        return null;
    }
}

export function saveIdentity (identity: Identity)
{
    try
    {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    }
    catch
    {
        // 저장소가 막혀 있으면 새로고침 때 다시 묻게 될 뿐이다
    }
}

export function clearIdentity ()
{
    try
    {
        sessionStorage.removeItem(STORAGE_KEY);
    }
    catch
    {
        // 위와 같다
    }
}
