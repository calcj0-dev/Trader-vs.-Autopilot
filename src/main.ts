import ja from './data/i18n/ja.json';
import { APP_VERSION, formatVersion } from './version';

// #1 準備：タイトル画面の仮の表示（画面の切り替えは #5、文言の仕組み t() は #5b で作る）
function renderPlaceholder(root: HTMLElement): void {
  root.innerHTML = '';

  const screen = document.createElement('main');
  screen.className = 'screen';

  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  const version = document.createElement('span');
  version.className = 'version';
  version.textContent = formatVersion(APP_VERSION);
  topBar.append(version);

  const title = document.createElement('h1');
  title.className = 'title';
  title.textContent = ja['title.main'];

  const sub = document.createElement('p');
  sub.className = 'subtitle';
  sub.textContent = ja['title.sub'];

  const lead = document.createElement('p');
  lead.className = 'lead';
  lead.textContent = ja['title.lead'];

  const preparing = document.createElement('p');
  preparing.className = 'preparing';
  preparing.textContent = ja['common.preparing'];

  screen.append(topBar, title, sub, lead, preparing);

  const disclaimer = document.createElement('footer');
  disclaimer.className = 'disclaimer';
  disclaimer.textContent = ja['common.disclaimer'];

  root.append(screen, disclaimer);
}

const root = document.querySelector<HTMLElement>('#app');
if (root) renderPlaceholder(root);
