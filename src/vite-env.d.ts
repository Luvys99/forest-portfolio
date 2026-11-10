/// <reference types="vite/client" />

// .env.local에 넣는 값 (VITE_로 시작해야 브라우저 코드에서 읽을 수 있다)
interface ImportMetaEnv
{
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta
{
    readonly env: ImportMetaEnv;
}
