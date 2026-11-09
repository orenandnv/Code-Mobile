import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import './styles.css';
import './styles/app-extra.css';

const container = document.getElementById('root');
if (!container) throw new Error('elemento #root não encontrado');

createRoot(container).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
