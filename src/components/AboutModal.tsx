import { About } from '../game/data/about';
import { Modal } from './Modal';

interface Props
{
    about: About;
    onClose: () => void;
}

export function AboutModal ({ about, onClose }: Props)
{
    return (
        <Modal titleId="about-title" onClose={onClose}>
            <p className="modal-subtitle">소개</p>
            <h2 id="about-title" className="modal-title">{about.name}</h2>

            <p className="modal-summary">{about.headline}</p>

            {about.intro.map(line => <p key={line} className="modal-text">{line}</p>)}

            {about.interests.length > 0 && (
                <ul className="modal-stack">
                    {about.interests.map(item => <li key={item}>{item}</li>)}
                </ul>
            )}

            {about.links.length > 0 && (
                <div className="modal-links">
                    {about.links.map(({ label, url }) =>
                    {
                        // mailto: 링크는 메일 앱을 열기만 하므로 새 탭이 필요 없다
                        const external = !url.startsWith('mailto:');
                        return (
                            <a key={url} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                                {label} {external ? '↗' : '✉'}
                            </a>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
