import { ReactNode, useEffect, useRef } from 'react';

interface Props
{
    titleId: string;
    onClose: () => void;
    // 내용이 많은 팝업 (방명록)은 넓게
    wide?: boolean;
    children: ReactNode;
}

// 상세 팝업과 소개 팝업이 같이 쓰는 틀 (배경, 닫기 버튼, ESC)
export function Modal ({ titleId, onClose, wide = false, children }: Props)
{
    const closeButton = useRef<HTMLButtonElement>(null);

    // ESC로 닫기 + 열리면 닫기 버튼에 포커스 (키보드로 바로 닫을 수 있게)
    useEffect(() =>
    {
        closeButton.current?.focus();

        const onKeyDown = (event: KeyboardEvent) =>
        {
            if (event.key === 'Escape')
            {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        // 바깥(어두운 배경)을 누르면 닫힌다. 안쪽 클릭은 막는다
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className={wide ? 'modal modal-wide' : 'modal'}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={event => event.stopPropagation()}
            >
                <button ref={closeButton} className="modal-close" onClick={onClose} aria-label="닫기">×</button>
                {children}
            </div>
        </div>
    );
}
