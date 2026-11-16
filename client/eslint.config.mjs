import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Vite React 템플릿 기본 설정 + 이 저장소의 경계 규칙
export default tseslint.config(
    { ignores: [ 'dist' ] },
    {
        extends: [ js.configs.recommended, ...tseslint.configs.recommended ],
        files: [ '**/*.{ts,tsx}' ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [ 'warn', { allowConstantExport: true } ],
            // 디버그 출력이 남지 않게. 사용자에게 보여 줄 수 없는 설정 오류만 warn/error로 남긴다
            'no-console': [ 'error', { allow: [ 'warn', 'error' ] } ]
        }
    },

    // 경계 1: Phaser 쪽(game/)은 React를 모른다. 팝업을 열고 싶으면 EventBus로 신호만 보낸다
    {
        files: [ 'src/game/**/*.ts' ],
        rules: {
            'no-restricted-imports': [ 'error', {
                patterns: [ {
                    group: [ '**/components/**', 'react', 'react-dom', '**/App', '**/PhaserGame' ],
                    message: 'game/ 은 React 쪽을 import하지 않습니다. EventBus.emit 으로 신호만 보내세요.'
                } ]
            } ]
        }
    },

    // 경계 2: React 쪽은 Phaser 씬·객체·게임 인스턴스를 직접 다루지 않는다.
    // game/ 에서 가져와도 되는 것: 데이터 타입(game/data), EventBus, 순수 유틸(game/world/sky-record 등)
    {
        files: [ 'src/components/**/*.tsx', 'src/App.tsx' ],
        rules: {
            'no-restricted-imports': [ 'error', {
                patterns: [ {
                    group: [ '**/game/scenes/**', '**/game/objects/**', '**/game/main', 'phaser' ],
                    message: 'React 쪽은 Phaser 씬·객체를 import하지 않습니다. EventBus.on 으로 받으세요.'
                } ]
            } ]
        }
    }
);
