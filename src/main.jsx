import './lib/storage.js'; // 必须在 App 之前引入，注入 window.storage 的 localStorage 实现

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 註冊 Service Worker：這是「可安裝成 PWA」的必要條件之一。
// 放在 load 事件之後才註冊，避免搶首屏渲染的資源；失敗也不影響 App 本身正常使用
// （例如某些瀏覽器完全不支援 Service Worker，就單純沒有離線快取和安裝功能而已）。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
