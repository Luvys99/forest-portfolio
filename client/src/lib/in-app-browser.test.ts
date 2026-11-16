import { describe, expect, it } from 'vitest';
import { externalBrowserUrl } from './in-app-browser';

const SITE = 'https://forest-portfolio-pi.vercel.app/';

// 실제 기기에서 쓰이는 형태의 user agent
const KAKAO_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410150';
const KAKAO_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

describe('externalBrowserUrl', () =>
{
    it('카카오톡 안에서 열리면(안드로이드, iOS) 외부 브라우저로 여는 주소를 준다', () =>
    {
        const expected = `kakaotalk://web/openExternal?url=${encodeURIComponent(SITE)}`;
        expect(externalBrowserUrl(KAKAO_ANDROID, SITE)).toBe(expected);
        expect(externalBrowserUrl(KAKAO_IOS, SITE)).toBe(expected);
    });

    it('일반 브라우저에서는 아무 데도 보내지 않는다 (다시 넘어간 뒤 반복되지 않는다)', () =>
    {
        expect(externalBrowserUrl(CHROME_ANDROID, SITE)).toBeNull();
        expect(externalBrowserUrl(SAFARI_IOS, SITE)).toBeNull();
    });

    it('주소의 경로와 쿼리도 그대로 넘긴다', () =>
    {
        const href = 'https://forest-portfolio-pi.vercel.app/?from=kakao&x=1#top';
        const url = externalBrowserUrl(KAKAO_ANDROID, href)!;
        expect(decodeURIComponent(url.split('url=')[1])).toBe(href);
    });
});
