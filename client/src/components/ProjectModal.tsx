import { Project } from '../game/data/projects';
import { Modal } from './Modal';

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
    const links = Object.entries(project.links).filter(([, url]) => url);

    return (
        <Modal titleId="modal-title" onClose={onClose}>
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

                    {project.features && (
                        <ul className="modal-features" aria-label="주요 기능">
                            {project.features.map(feature => <li key={feature}>{feature}</li>)}
                        </ul>
                    )}

                    {project.diagram && (
                        <figure className="modal-diagram">
                            <img src={project.diagram.src} alt={project.diagram.alt} />
                        </figure>
                    )}

                    {project.decisions && (
                        <section className="modal-section">
                            <h3>왜 이렇게 만들었나</h3>
                            {project.decisions.map(d => (
                                <article key={d.title} className="modal-decision">
                                    <h4>{d.title}</h4>
                                    <p>{d.decision}</p>
                                    <dl>
                                        <dt>이유</dt><dd>{d.why}</dd>
                                        <dt>포기한 것</dt><dd>{d.tradeoff}</dd>
                                    </dl>
                                </article>
                            ))}
                        </section>
                    )}

                    {project.details.length > 0 && (
                        <ul className="modal-details">
                            {project.details.map(line => <li key={line}>{line}</li>)}
                        </ul>
                    )}

                    {project.sections?.map(section => (
                        <section key={section.title} className="modal-section">
                            <h3>{section.title}</h3>
                            <ul className="modal-details">
                                {section.items.map(line => <li key={line}>{line}</li>)}
                            </ul>
                        </section>
                    ))}

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
        </Modal>
    );
}
