import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@govbr-ds/core/dist/core.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { defineCustomElements } from '@govbr-ds/webcomponents/dist/loader/index.js';

defineCustomElements();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
