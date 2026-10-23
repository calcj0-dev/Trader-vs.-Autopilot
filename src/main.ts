import './style.css';
import { setLocale } from './i18n';
import { createApp } from './ui/app';
import { modals } from './ui/modals';
import { disclaimer } from './ui/parts';
import { playScreen } from './ui/screens/play';
import { resultScreen } from './ui/screens/result';
import { rulesScreen } from './ui/screens/rules';
import { titleScreen } from './ui/screens/title';

setLocale('ja');

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  const app = createApp(
    root,
    { title: titleScreen, rules: rulesScreen, play: playScreen, result: resultScreen },
    modals,
    disclaimer(),
  );
  app.go('title');

  // 開発用：?screen=play&modal=pause のように、画面と重ね表示を直接開く（公開版では無視する）
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    const screen = q.get('screen');
    const modal = q.get('modal');
    if (screen === 'title' || screen === 'rules' || screen === 'play' || screen === 'result') app.go(screen);
    if (modal && modal in modals) app.openModal(modal as keyof typeof modals);
  }
}
