import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DrawerApp } from './DrawerApp';
import './styles/app.css';

// FD-92: the console drawer's own view loads this page with `?drawer=1` and shows only the console.
const drawer = new URLSearchParams(window.location.search).get('drawer') === '1';
createRoot(document.getElementById('root')!).render(<StrictMode>{drawer ? <DrawerApp /> : <App />}</StrictMode>);
