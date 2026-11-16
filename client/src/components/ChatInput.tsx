import { FormEvent, KeyboardEvent, useState } from 'react';
import { CHAT_MAX, relay } from '../lib/relay';

interface Props
{
    onClose: () => void;
}

// 말풍선 입력창 (화면 위쪽 가운데. 휴대폰 키보드에 가리지 않게).
// 열려 있는 동안 캐릭터는 잠겨 있다 (Multiplayer 가 ModalLock 으로 연다). Enter 보내기, Esc 닫기
export function ChatInput ({ onClose }: Props)
{
    const [ text, setText ] = useState('');

    const submit = (event: FormEvent) =>
    {
        event.preventDefault();
        relay?.sendChat(text);
        onClose();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key === 'Escape')
        {
            onClose();
        }
    };

    return (
        <form className="chat-input" onSubmit={submit}>
            <input
                autoFocus
                value={text}
                onChange={event => setText(event.target.value)}
                onKeyDown={onKeyDown}
                onBlur={onClose}
                maxLength={CHAT_MAX}
                placeholder={`말풍선 (${CHAT_MAX}자, Enter 보내기 · Esc 닫기)`}
                aria-label="말풍선"
                enterKeyHint="send"
            />
        </form>
    );
}
