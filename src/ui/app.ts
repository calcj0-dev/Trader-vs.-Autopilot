// 画面の切り替えと重ね表示（設計書 5.2・5.3・7.10）。ページの読み込みは起こさない

export type ScreenName = 'title' | 'rules' | 'play' | 'result';
export type ModalName = 'pause' | 'settings' | 'params' | 'image' | 'portrait' | 'privacy';

export type App = {
  go(screen: ScreenName): void;
  openModal(modal: ModalName): void;
  closeModal(): void;
  closeAllModals(): void;
  readonly screen: ScreenName;
};

export type ScreenView = { el: HTMLElement; unmount?: () => void };
export type ScreenFactory = (app: App) => ScreenView;
export type ModalFactory = (app: App) => HTMLElement;

export function createApp(
  root: HTMLElement,
  screens: Record<ScreenName, ScreenFactory>,
  modals: Record<ModalName, ModalFactory>,
  footer: HTMLElement,
): App {
  const main = document.createElement('div');
  main.className = 'screen-host';
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  root.replaceChildren(main, footer, dialog);

  let current: ScreenView | null = null;
  let screenName: ScreenName = 'title';
  // 重ね表示から別の重ね表示を開いたとき（一時停止→設定）に、閉じたら元へ戻るため
  const stack: ModalName[] = [];

  const renderModal = (name: ModalName) => {
    dialog.replaceChildren(modals[name](app));
    dialog.dataset.modal = name;
    if (!dialog.open) dialog.showModal();
  };

  const app: App = {
    get screen() {
      return screenName;
    },
    go(next) {
      app.closeAllModals();
      current?.unmount?.();
      screenName = next;
      current = screens[next](app);
      main.replaceChildren(current.el);
      main.dataset.screen = next;
      window.scrollTo(0, 0);
    },
    openModal(name) {
      stack.push(name);
      renderModal(name);
    },
    closeModal() {
      stack.pop();
      const prev = stack[stack.length - 1];
      if (prev) renderModal(prev);
      else if (dialog.open) dialog.close();
    },
    closeAllModals() {
      stack.length = 0;
      if (dialog.open) dialog.close();
    },
  };

  // Esc で閉じたときも重ね表示の記録を合わせる
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    app.closeModal();
  });

  return app;
}
