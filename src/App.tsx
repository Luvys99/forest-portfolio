import { useCallback, useEffect, useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { EventBus } from './game/EventBus';
import { Project } from './game/data/projects';
import { ProjectModal } from './components/ProjectModal';

function App()
{
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [project, setProject] = useState<Project | null>(null);

    // 구슬 앞에서 ↑ → Phaser가 보낸 프로젝트 데이터로 모달을 연다
    useEffect(() =>
    {
        const open = (data: Project) => setProject(data);
        EventBus.on('open-project', open);
        return () =>
        {
            EventBus.off('open-project', open);
        };
    }, []);

    // 닫히면 Phaser에 알려서 캐릭터 조작을 다시 풀게 한다
    const close = useCallback(() =>
    {
        setProject(null);
        EventBus.emit('modal-closed');
    }, []);

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} />
            {project && <ProjectModal project={project} onClose={close} />}
        </div>
    )
}

export default App
