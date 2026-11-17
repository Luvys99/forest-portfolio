import { useEffect, useRef } from 'react';

interface Props
{
    onVisible: () => void;
    // 바뀔 때마다 다시 지켜본다. 이어 붙인 뒤에도 끝이 여전히 화면 안이면(글이 짧으면) 한 번 더 부르기 위해
    watchKey: number;
}

// 목록 끝에 두는 빈 칸. 화면(팝업 스크롤 안)에 들어오면 onVisible
export function LoadMoreSentinel ({ onVisible, watchKey }: Props)
{
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        const el = ref.current;
        if (!el)
        {
            return;
        }
        // 끝에 닿기 조금 전에 미리 불러온다
        const observer = new IntersectionObserver(([ entry ]) =>
        {
            if (entry.isIntersecting)
            {
                onVisible();
            }
        }, { rootMargin: '0px 0px 200px 0px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ onVisible, watchKey ]);

    return <div ref={ref} className="guestbook-sentinel" aria-hidden="true" />;
}
