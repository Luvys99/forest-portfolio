import { useEffect, useRef } from 'react';
import { Project } from '../game/data/projects';

interface Props
{
    project: Project;
    onClose: () => void;
}

const LINK_LABELS: Record<string, string> = {
    github: 'GitHub',
    demo: '배포 사이트',
    blog: '블로그 글'
};

export function ProjectModal ({ project, onClose }: Props)
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

    const links = Object.entries(project.links).filter(([, url]) => url);

    return (
        // 바깥(어두운 배경)을 누르면 닫힌다. 안쪽 클릭은 막는다
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={event => event.stopPropagation()}
            >
                <button ref={closeButton} className="modal-close" onClick={onClose} aria-label="닫기">×</button>

                <p className="modal-subtitle">{project.subtitle}</p>
                <h2 id="modal-title" className="modal-title">{project.title}</h2>

                {project.comingSoon ? (
                    <p className="modal-coming-soon">준비 중입니다. 곧 이 나무에 열매가 열려요.</p>
                ) : (
                    <>
                        {(project.period || project.role) && (
                            <dl className="modal-meta">
                                {project.period && <><dt>기간</dt><dd>{project.period}</dd></>}
                                {project.role && <><dt>역할</dt><dd>{project.role}</dd></>}
                            </dl>
                        )}

                        {project.image && <img className="modal-image" src={project.image} alt={`${project.title} 화면`} />}

                        <p className="modal-summary">{project.summary}</p>

                        {project.details.length > 0 && (
                            <ul className="modal-details">
                                {project.details.map(line => <li key={line}>{line}</li>)}
                            </ul>
                        )}

                        {project.stack.length > 0 && (
                            <ul className="modal-stack">
                                {project.stack.map(tech => <li key={tech}>{tech}</li>)}
                            </ul>
                        )}

                        {links.length > 0 && (
                            <div className="modal-links">
                                {links.map(([key, url]) => (
                                    <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                                        {LINK_LABELS[key] ?? key} ↗
                                    </a>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
