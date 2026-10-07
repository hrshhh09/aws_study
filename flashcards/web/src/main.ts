import './styles.css';
import { loadDecks } from './loader';
import { app } from './state';
import { Home } from './views/Home';
import { Browse } from './views/Browse';
import { Study, stopStudy } from './views/Study';
import { Summary } from './views/Summary';
import { syncEnabled, syncNow } from './sync';
import { store } from './store';

const root = document.getElementById('app')!;

// theme
const THEME = 'flashcards:theme';
const applyTheme = (t: string | null) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(localStorage.getItem(THEME));
document.getElementById('theme-toggle')!.onclick = () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  localStorage.setItem(THEME, next);
  applyTheme(next);
};

function route() {
  stopStudy();
  root.onclick = null;
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs);
  window.scrollTo(0, 0);
  document.body.dataset.view = path.slice(1) || 'home';
  switch (path) {
    case '/browse': return Browse(root, params);
    case '/study': return Study(root, params);
    case '/summary': return Summary(root);
    default: return Home(root);
  }
}

// "/" focuses search (navigates to Browse if needed)
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.target instanceof HTMLInputElement) return;
  e.preventDefault();
  const s = document.querySelector<HTMLInputElement>('#search');
  if (s) s.focus(); else { location.hash = '#/browse'; setTimeout(() => document.querySelector<HTMLInputElement>('#search')?.focus(), 50); }
});

(async () => {
  root.innerHTML = '<p class="muted center">Loading decks…</p>';
  app.data = await loadDecks();
  window.addEventListener('hashchange', route);
  route();

  if (syncEnabled && store.meta.get().syncCode) {
    syncNow().then(() => { if (!location.hash || location.hash === '#/') route(); }).catch(() => {});
  }
})();
