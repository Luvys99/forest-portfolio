import { FormEvent, useState } from 'react';
import { Modal } from './Modal';
import { normalizeName, PALETTE, saveIdentity } from '../lib/identity';
import { NAME_MAX } from '../lib/skyRecords';

interface Props
{
    // 서버가 입장을 거절했을 때 다시 띄우며 보여 주는 이유
    error?: string;
    onClose: () => void;
}

// 멀티플레이 입장 팝업: 다른 방문자에게 보일 이름과 정령 색.
// "입장"은 저장만 하고 닫는다. 접속은 Forest 씬이 닫힘을 받아 처리한다. 입력 없이 닫으면 혼자 둘러본다
export function EnterModal ({ error, onClose }: Props)
{
    const [ name, setName ] = useState('');
    const [ color, setColor ] = useState(PALETTE[0].hex);
    const normalized = normalizeName(name);

    const submit = (event: FormEvent) =>
    {
        event.preventDefault();
        if (!normalized)
        {
            return;
        }
        saveIdentity({ name: normalized, color });
        onClose();
    };

    return (
        <Modal titleId="enter-title" onClose={onClose} focusClose={false}>
            <p className="modal-subtitle">멀티플레이</p>
            <h2 id="enter-title" className="modal-title">숲에 들어가기</h2>
            <p className="modal-text">같은 시간에 들어온 방문자들이 서로의 정령을 볼 수 있어요. 보일 이름과 색을 골라 주세요.</p>

            <form className="enter-form" onSubmit={submit}>
                <input
                    autoFocus
                    value={name}
                    onChange={event => setName(event.target.value)}
                    maxLength={NAME_MAX}
                    placeholder={`이름 (${NAME_MAX}자)`}
                    aria-label="이름"
                    required
                />

                <div className="enter-colors" role="radiogroup" aria-label="정령 색">
                    {PALETTE.map(c => (
                        <button
                            key={c.hex}
                            type="button"
                            role="radio"
                            aria-checked={color === c.hex}
                            aria-label={c.label}
                            title={c.label}
                            className={color === c.hex ? 'enter-color is-selected' : 'enter-color'}
                            style={{ background: `#${c.hex}` }}
                            onClick={() => setColor(c.hex)}
                        />
                    ))}
                </div>

                <div className="enter-actions">
                    <button type="submit" disabled={!normalized}>입장</button>
                    <button type="button" className="enter-alone" onClick={onClose}>혼자 둘러보기</button>
                </div>

                {error && <p className="guestbook-error">{error}</p>}
            </form>
        </Modal>
    );
}
