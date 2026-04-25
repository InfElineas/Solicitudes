import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-notifications.js').catch((err) => {
      console.error('[SW] register error', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
