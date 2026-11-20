import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {ensureOneTimeCleanReset} from './services/localCacheReset';

ensureOneTimeCleanReset();

createRoot(document.getElementById('root')!).render(<App />);
