import { useCallback, useRef, useState } from 'react';
import { fetchGuestbook, GUESTBOOK_PAGE, GuestbookEntry } from '../lib/guestbook';

// 방명록을 한 묶음씩 이어 붙인다 (#60). 첫 묶음은 reset, 그다음부터는 목록 끝에 닿으면 loadMore
export function useGuestbookPages ()
{
    const [ entries, setEntries ] = useState<GuestbookEntry[]>([]);
    const [ hasMore, setHasMore ] = useState(false);
    const [ loadingMore, setLoadingMore ] = useState(false);
    const [ moreError, setMoreError ] = useState(false);

    // 마지막으로 받은 글. 다음 묶음은 이 글보다 오래된 것부터
    const lastId = useRef<number | null>(null);
    const busy = useRef(false);
    // 새 글을 쓴 뒤 첫 묶음을 다시 받으면, 그 전에 보낸 '더 불러오기' 응답은 버린다
    const generation = useRef(0);

    const accept = (page: GuestbookEntry[]) =>
    {
        if (page.length > 0)
        {
            lastId.current = page[page.length - 1].id;
        }
        setHasMore(page.length === GUESTBOOK_PAGE);
    };

    // 실패하면 그대로 던진다 (팝업이 '불러오지 못했어요'를 보여 준다)
    const reset = useCallback(async () =>
    {
        const gen = ++generation.current;
        const page = await fetchGuestbook();
        if (gen !== generation.current)
        {
            return;
        }
        lastId.current = null;
        setEntries(page);
        setMoreError(false);
        accept(page);
    }, []);

    const loadMore = useCallback(async () =>
    {
        if (busy.current || lastId.current === null)
        {
            return;
        }
        busy.current = true;
        setLoadingMore(true);
        setMoreError(false);
        const gen = generation.current;
        try
        {
            const page = await fetchGuestbook(lastId.current);
            if (gen === generation.current)
            {
                setEntries(prev => [ ...prev, ...page ]);
                accept(page);
            }
        }
        catch
        {
            setMoreError(true);
        }
        finally
        {
            busy.current = false;
            setLoadingMore(false);
        }
    }, []);

    return { entries, hasMore, loadingMore, moreError, reset, loadMore };
}
