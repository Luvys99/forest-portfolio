import { describe, expect, it } from 'vitest';
import { formatTime } from './sky-record';

describe('formatTime', () =>
{
    it('밀리초를 분:초.백분초로 보여 준다', () =>
    {
        expect(formatTime(0)).toBe('0:00.00');
        expect(formatTime(83456)).toBe('1:23.45');
        expect(formatTime(60000)).toBe('1:00.00');
        expect(formatTime(5999)).toBe('0:05.99');
    });

    it('59.999초는 1분으로 올림되지 않는다', () =>
    {
        expect(formatTime(59999)).toBe('0:59.99');
        expect(formatTime(119999)).toBe('1:59.99');
    });
});
