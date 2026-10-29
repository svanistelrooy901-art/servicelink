import { useSyncExternalStore } from 'react';
import { getLanguage, setLanguage, subscribe } from './index';
export function LanguageSwitch() {
  const language = useSyncExternalStore(subscribe, getLanguage);
  return (
    <div className="language-switch" role="group" aria-label="Bahasa / Language">
      <button
        type="button"
        lang="ms"
        aria-label="Bahasa Melayu"
        aria-pressed={language === 'bm'}
        onClick={() => setLanguage('bm')}
      >
        BM
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        lang="en"
        aria-label="English"
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
