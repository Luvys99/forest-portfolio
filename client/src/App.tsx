import { useCallback, useEffect, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { EventBus } from './game/EventBus';
import { Project } from './game/data/projects';
import { About } from './game/data/about';
import { ProjectModal } from './components/ProjectModal';
import { AboutModal } from './components/AboutModal';
import { GuestbookModal } from './components/GuestbookModal';
import { EnterModal } from './components/EnterModal';
import { BgmToggle } from './components/BgmToggle';
import { TouchControls } from './components/TouchControls';
import { RotateHint } from './components/RotateHint';
import { MultiplayerHud } from './components/MultiplayerHud';
import { ChatInput } from './components/ChatInput';

// 지금 열려 있는 팝업 (한 번에 하나만)
type OpenModal =
    | { type: 'project'; project: Project }
    | { type: 'about'; about: About }
    | { type: 'guestbook'; clearMs: number | null }
    | { type: 'enter'; error?: string }
    | { type: 'chat' }
    | null;

function App()
{
    const [modal, setModal] = useState<OpenModal>(null);

    // 구슬 앞에서 ↑ → Phaser가 보낸 데이터로 팝업을 연다
    useEffect(() =>
    {
        const openProject = (project: Project) => setModal({ type: 'project', project });
        const openAbout = (about: About) => setModal({ type: 'about', about });
        const openGuestbook = ({ clearMs }: { clearMs: number | null }) => setModal({ type: 'guestbook', clearMs });
        const openEnter = ({ error }: { error?: string } = {}) => setModal({ type: 'enter', error });
        const openChat = () => setModal({ type: 'chat' });
        EventBus.on('open-project', openProject);
        EventBus.on('open-about', openAbout);
        EventBus.on('open-guestbook', openGuestbook);
        EventBus.on('open-enter', openEnter);
        EventBus.on('open-chat', openChat);
        return () =>
        {
            EventBus.off('open-project', openProject);
            EventBus.off('open-about', openAbout);
            EventBus.off('open-guestbook', openGuestbook);
            EventBus.off('open-enter', openEnter);
            EventBus.off('open-chat', openChat);
        };
    }, []);

    // 닫히면 Phaser에 알려서 캐릭터 조작을 다시 풀게 한다
    const close = useCallback(() =>
    {
        setModal(null);
        EventBus.emit('modal-closed');
    }, []);

    return (
        <div id="app">
            <PhaserGame />
            <BgmToggle />
            <TouchControls />
            <RotateHint />
            <MultiplayerHud enabled={modal === null} />
            {modal?.type === 'project' && <ProjectModal project={modal.project} onClose={close} />}
            {modal?.type === 'about' && <AboutModal about={modal.about} onClose={close} />}
            {modal?.type === 'guestbook' && <GuestbookModal clearMs={modal.clearMs} onClose={close} />}
            {modal?.type === 'enter' && <EnterModal error={modal.error} onClose={close} />}
            {modal?.type === 'chat' && <ChatInput onClose={close} />}
        </div>
    )
}

export default App
