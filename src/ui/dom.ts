// DOM を組み立てる小さな道具

type Props = {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: (Node | string | null | undefined | false)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.className) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [type, fn] of Object.entries(props.on ?? {})) el.addEventListener(type, fn as EventListener);
  for (const c of children) if (c) el.append(c);
  return el;
}

/** 文字のボタン */
export function button(text: string, onClick: () => void, className = 'btn'): HTMLButtonElement {
  return h('button', { className, text, attrs: { type: 'button' }, on: { click: onClick } });
}

/** 文字リンク風のボタン（画面の中で開くもの） */
export function linkButton(text: string, onClick: () => void): HTMLButtonElement {
  return button(text, onClick, 'link');
}

/** 外部へのリンク（新しいタブ） */
export function externalLink(text: string, href: string): HTMLAnchorElement {
  return h('a', { className: 'link', text, attrs: { href, target: '_blank', rel: 'noopener' } });
}
