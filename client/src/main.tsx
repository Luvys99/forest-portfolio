import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { externalBrowserUrl } from './lib/in-app-browser';

// 카카오톡 안에서 열렸으면 기기 브라우저로 넘긴다 (화면을 그리기 전에)
const external = externalBrowserUrl(navigator.userAgent, location.href);
if (external)
{
    location.href = external;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
