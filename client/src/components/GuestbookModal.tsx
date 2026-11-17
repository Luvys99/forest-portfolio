import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Modal } from './Modal';
import { EventBus } from '../game/EventBus';
import { formatTime, loadBest } from '../game/world/sky-record';
import { addGuestbookEntry, fetchGuestbook, GuestbookEntry, MESSAGE_MAX, NAME_MAX } from '../lib/guestbook';
import { addRecord, fetchRanking, Ranking } from '../lib/skyRecords';
import { supabaseEnabled } from '../lib/supabase';

interface Props
{
    // 이번 판에 클리어한 기록 (있으면 순위표에 올릴 수 있다)
    clearMs: number | null;
    onClose: () => void;
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

// 보내는 중·실패 문구를 폼마다 따로 둔다
function useSubmit ()
{
    const [ sending, setSending ] = useState(false);
    const [ error, setError ] = useState('');

    const run = async (action: () => Promise<void>) =>
    {
        setSending(true);
        setError('');
        try
        {
            await action();
        }
        catch (e)
        {
            setError(e instanceof Error ? e.message : '남기지 못했어요');
        }
        finally
        {
            setSending(false);
        }
    };

    return { sending, error, run };
}

export function GuestbookModal ({ clearMs, onClose }: Props)
{
    const [ ranking, setRanking ] = useState<Ranking>({ records: [], players: 0 });
    const [ entries, setEntries ] = useState<GuestbookEntry[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ loadError, setLoadError ] = useState('');

    // 두 폼이 이름을 같이 쓴다
    const [ name, setName ] = useState('');
    const [ message, setMessage ] = useState('');
    const record = useSubmit();
    const entry = useSubmit();
    const [ myRecordId, setMyRecordId ] = useState<number | null>(null);
    const [ myEntryId, setMyEntryId ] = useState<number | null>(null);
    // 올린 기록이 이 브라우저 최고 기록보다 느리면, 순위표에는 최고 기록이 그대로 남는다고 알려 준다
    const [ keptBest, setKeptBest ] = useState<number | null>(null);

    const load = useCallback(async () =>
    {
        setLoading(true);
        setLoadError('');
        try
        {
            const [ top, latest ] = await Promise.all([ fetchRanking(), fetchGuestbook() ]);
            setRanking(top);
            setEntries(latest);
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
        if (supabaseEnabled)
        {
            load();
        }
    }, [ load ]);

    const submitRecord = (event: FormEvent) =>
    {
        event.preventDefault();
        if (clearMs === null || !name.trim() || record.sending)
        {
            return;
        }

        record.run(async () =>
        {
            const saved = await addRecord(name, clearMs);
            setMyRecordId(saved.id);
            const best = loadBest();
            setKeptBest(best !== null && best < clearMs ? best : null);
            // 이번 판 기록은 한 번만 올릴 수 있다
            EventBus.emit('record-saved');
            setRanking(await fetchRanking());
        });
    };

    const submitEntry = (event: FormEvent) =>
    {
        event.preventDefault();
        if (!name.trim() || !message.trim() || entry.sending)
        {
            return;
        }

        entry.run(async () =>
        {
            const saved = await addGuestbookEntry(name, message);
            setMyEntryId(saved.id);
            setMessage('');
            setEntries(await fetchGuestbook());
        });
    };

    const nameInput = (
        <input
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={NAME_MAX}
            placeholder={`이름 (${NAME_MAX}자)`}
            aria-label="이름"
            required
        />
    );

    return (
        <Modal titleId="guestbook-title" onClose={onClose} wide>
            <p className="modal-subtitle">밤하늘 점프맵</p>
            <h2 id="guestbook-title" className="modal-title">방명록 · 순위</h2>

            {!supabaseEnabled && <p className="modal-coming-soon">방명록이 아직 준비되지 않았어요.</p>}

            {supabaseEnabled && clearMs !== null && myRecordId === null && (
                <form className="guestbook-form is-record" onSubmit={submitRecord}>
                    <p className="guestbook-clear">클리어 기록 <strong>{formatTime(clearMs)}</strong> 을 순위표에 올려 보세요</p>
                    {nameInput}
                    <button type="submit" disabled={record.sending || !name.trim()}>
                        {record.sending ? '올리는 중…' : '순위표에 올리기'}
                    </button>
                    {record.error && <p className="guestbook-error">{record.error}</p>}
                </form>
            )}
            {myRecordId !== null && <p className="guestbook-done">순위표에 올렸어요!</p>}
            {keptBest !== null && (
                <p className="guestbook-kept">순위표에는 이 브라우저의 가장 빠른 기록 <strong>{formatTime(keptBest)}</strong> 이 올라가 있어요</p>
            )}

            {supabaseEnabled && myEntryId === null && (
                <form className="guestbook-form" onSubmit={submitEntry}>
                    <p className="guestbook-clear">다녀간 흔적을 남겨 주세요</p>
                    {nameInput}
                    <input
                        className="guestbook-message"
                        value={message}
                        onChange={event => setMessage(event.target.value)}
                        maxLength={MESSAGE_MAX}
                        placeholder={`한마디 (${MESSAGE_MAX}자)`}
                        aria-label="한마디"
                        required
                    />
                    <button type="submit" disabled={entry.sending || !name.trim() || !message.trim()}>
                        {entry.sending ? '남기는 중…' : '남기기'}
                    </button>
                    {entry.error && <p className="guestbook-error">{entry.error}</p>}
                </form>
            )}
            {myEntryId !== null && <p className="guestbook-done">방명록에 남겼어요. 고마워요!</p>}

            {supabaseEnabled && (
                loading ? <p className="modal-text">불러오는 중…</p>
                : loadError ? <p className="guestbook-error">{loadError}</p>
                : (
                    <div className="guestbook-columns">
                        <section>
                            <h3>순위 TOP 10</h3>
                            {ranking.players > 0 && <p className="guestbook-players">지금까지 {ranking.players}명이 달에 닿았어요</p>}
                            {ranking.records.length === 0 ? <p className="guestbook-empty">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</p> : (
                                <ol className="guestbook-ranking">
                                    {ranking.records.map((r, i) => (
                                        <li key={r.id} className={r.id === myRecordId ? 'is-mine' : undefined}>
                                            <span className="rank">{i + 1}</span>
                                            <span className="name">{r.name}</span>
                                            <span className="time">{formatTime(r.time_ms)}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </section>

                        <section>
                            <h3>방명록</h3>
                            {entries.length === 0 ? <p className="guestbook-empty">아직 남긴 글이 없어요. 첫 글을 남겨 보세요!</p> : (
                                <ul className="guestbook-recent">
                                    {entries.map(e => (
                                        <li key={e.id} className={e.id === myEntryId ? 'is-mine' : undefined}>
                                            <div>
                                                <span className="name">{e.name}</span>
                                                <span className="meta">{formatDate(e.created_at)}</span>
                                            </div>
                                            <p>{e.message}</p>
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
