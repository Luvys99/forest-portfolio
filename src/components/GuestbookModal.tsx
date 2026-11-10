import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Modal } from './Modal';
import { EventBus } from '../game/EventBus';
import { formatTime } from '../game/world/sky-record';
import { addRecord, fetchRanking, fetchRecent, guestbookEnabled, MESSAGE_MAX, NAME_MAX, SkyRecord } from '../lib/skyRecords';

interface Props
{
    // 이번 판에 클리어한 기록 (있으면 방명록을 남길 수 있다)
    clearMs: number | null;
    onClose: () => void;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

export function GuestbookModal ({ clearMs, onClose }: Props)
{
    const [ ranking, setRanking ] = useState<SkyRecord[]>([]);
    const [ recent, setRecent ] = useState<SkyRecord[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ loadError, setLoadError ] = useState('');

    const [ name, setName ] = useState('');
    const [ message, setMessage ] = useState('');
    const [ sending, setSending ] = useState(false);
    const [ sendError, setSendError ] = useState('');
    const [ myId, setMyId ] = useState<number | null>(null);

    const load = useCallback(async () =>
    {
        setLoading(true);
        setLoadError('');
        try
        {
            const [ top, latest ] = await Promise.all([ fetchRanking(), fetchRecent() ]);
            setRanking(top);
            setRecent(latest);
        }
        catch
        {
            setLoadError('방명록을 불러오지 못했어요. 잠시 뒤에 다시 열어 주세요.');
        }
        finally
        {
            setLoading(false);
        }
    }, []);

    useEffect(() =>
    {
        if (guestbookEnabled)
        {
            load();
        }
    }, [ load ]);

    const submit = async (event: FormEvent) =>
    {
        event.preventDefault();
        if (clearMs === null || !name.trim() || sending)
        {
            return;
        }

        setSending(true);
        setSendError('');
        try
        {
            const record = await addRecord(name, message, clearMs);
            setMyId(record.id);
            // 이번 판 기록은 한 번만 남길 수 있다
            EventBus.emit('guestbook-written');
            await load();
        }
        catch (error)
        {
            setSendError(error instanceof Error ? error.message : '남기지 못했어요');
        }
        finally
        {
            setSending(false);
        }
    };

    const canWrite = clearMs !== null && myId === null;

    return (
        <Modal titleId="guestbook-title" onClose={onClose} wide>
            <p className="modal-subtitle">밤하늘 점프맵</p>
            <h2 id="guestbook-title" className="modal-title">방명록 · 순위</h2>

            {!guestbookEnabled && <p className="modal-coming-soon">방명록이 아직 준비되지 않았어요.</p>}

            {guestbookEnabled && canWrite && (
                <form className="guestbook-form" onSubmit={submit}>
                    <p className="guestbook-clear">클리어 기록 <strong>{formatTime(clearMs)}</strong> 을 남겨 보세요</p>
                    <input
                        value={name}
                        onChange={event => setName(event.target.value)}
                        maxLength={NAME_MAX}
                        placeholder={`이름 (${NAME_MAX}자)`}
                        aria-label="이름"
                        required
                    />
                    <input
                        value={message}
                        onChange={event => setMessage(event.target.value)}
                        maxLength={MESSAGE_MAX}
                        placeholder={`한마디 (${MESSAGE_MAX}자, 선택)`}
                        aria-label="한마디"
                    />
                    <button type="submit" disabled={sending || !name.trim()}>
                        {sending ? '남기는 중…' : '남기기'}
                    </button>
                    {sendError && <p className="guestbook-error">{sendError}</p>}
                </form>
            )}

            {myId !== null && <p className="guestbook-done">방명록에 남겼어요. 고마워요!</p>}

            {guestbookEnabled && (
                loading ? <p className="modal-text">불러오는 중…</p>
                : loadError ? <p className="guestbook-error">{loadError}</p>
                : (
                    <div className="guestbook-columns">
                        <section>
                            <h3>순위 TOP 10</h3>
                            {ranking.length === 0 ? <p className="guestbook-empty">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</p> : (
                                <ol className="guestbook-ranking">
                                    {ranking.map((record, i) => (
                                        <li key={record.id} className={record.id === myId ? 'is-mine' : undefined}>
                                            <span className="rank">{i + 1}</span>
                                            <span className="name">{record.name}</span>
                                            <span className="time">{formatTime(record.time_ms)}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>

                        <section>
                            <h3>최근 방명록</h3>
                            {recent.length === 0 ? <p className="guestbook-empty">아직 남긴 글이 없어요.</p> : (
                                <ul className="guestbook-recent">
                                    {recent.map(record => (
                                        <li key={record.id} className={record.id === myId ? 'is-mine' : undefined}>
                                            <div>
                                                <span className="name">{record.name}</span>
                                                <span className="meta">{formatTime(record.time_ms)} · {formatDate(record.created_at)}</span>
                                            </div>
                                            {record.message && <p>{record.message}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )
            )}
        </Modal>
    );
}
