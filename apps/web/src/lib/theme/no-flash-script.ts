import { THEME_STORAGE_KEY } from './ThemeProvider';

/**
 * Runs before paint (injected into <head>) to apply the persisted theme and
 * avoid a light-mode flash on first load. Kept tiny and dependency-free.
 */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
