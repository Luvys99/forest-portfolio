// public/about.json 형식 (소개 팝업)

export interface AboutLink
{
    label: string;
    url: string;
}

export interface About
{
    name: string;
    headline: string;
    // 소개 문단 (한 줄씩)
    intro: string[];
    interests: string[];
    links: AboutLink[];
}

export const ABOUT_KEY = 'about';
