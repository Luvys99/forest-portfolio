/// <reference types="vite/client" />

// .env.local에 넣는 값 (VITE_로 시작해야 브라우저 코드에서 읽을 수 있다)
interface ImportMetaEnv
{
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    readonly VITE_RELAY_URL?: string;
    // 테스트 전용: 실제 중계 서버에 붙어 보는 relay.integration.test.ts 가 읽는다
    readonly RELAY_TEST_URL?: string;
}

interface ImportMeta
{
    readonly env: ImportMetaEnv;
}
