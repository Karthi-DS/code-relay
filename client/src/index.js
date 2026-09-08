import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Suppress benign ResizeObserver warnings triggered by Monaco Editor automatic layout
window.addEventListener('error', (e) => {
  if (
    e.message?.includes('ResizeObserver loop completed with undelivered notifications') ||
    e.message?.includes('ResizeObserver loop limit exceeded')
  ) {
    const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
    const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
    if (resizeObserverErrDiv) resizeObserverErrDiv.style.display = 'none';
    if (resizeObserverErr) resizeObserverErr.style.display = 'none';
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
