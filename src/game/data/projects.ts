// public/projects.json 형식
// 프로젝트 내용은 JSON에서, 맵 위치는 world/layout.ts에서 관리한다 (id로 연결)

export interface ProjectLinks
{
    github?: string;
    demo?: string;
    blog?: string;
}

export interface Project
{
    id: string;
    title: string;
    // 구슬 아래에 보이는 한 줄
    subtitle: string;
    period: string;
    role: string;
    stack: string[];
    summary: string;
    // 상세 팝업에 보여줄 내용 (한 줄씩)
    details: string[];
    image?: string;
    links: ProjectLinks;
    // true면 "준비 중"으로 보여준다
    comingSoon?: boolean;
}

export const PROJECTS_KEY = 'projects';
