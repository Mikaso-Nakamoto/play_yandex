// Менеджер всплывающих окон (стек, анимации, своя прокрутка длинного содержимого)
import { h, makeScroller } from './dom.js';
import { icon } from './icons.js';
import { audio } from '../core/audio.js';

export class Popups {
  constructor(root, onChange) {
    this.root = root;
    this.stack = [];
    this.onChange = onChange || (() => {});
  }

  get isOpen() { return this.stack.length > 0; }
  get top() { return this.stack[this.stack.length - 1] || null; }

  /**
   * opts: { title, titleClass, body: Node|Node[], closable, onClose, scroll, id }
   */
  open(opts) {
    const scrollWrap = h('div', { class: 'card-scroll' }, opts.body);
    const bodyWrap = h('div', { class: 'card-body' }, scrollWrap);
    const card = h('div', { class: 'card' + (opts.cardClass ? ' ' + opts.cardClass : '') });
    if (opts.title) card.appendChild(h('div', { class: 'card-title ' + (opts.titleClass || '') }, opts.title));
    const p = { id: opts.id || '', opts, el: null, closed: false };
    if (opts.closable) {
      card.appendChild(h('button', {
        class: 'round card-close', 'aria-label': 'close', html: icon('close'),
        onclick: () => { audio.play('click'); this.close(p); },
      }));
    }
    card.appendChild(bodyWrap);
    const overlay = h('div', { class: 'overlay' }, card);
    p.el = overlay;
    p.close = () => this.close(p);
    this.root.appendChild(overlay);
    this.stack.push(p);
    // Если содержимое не помещается — включаем свою прокрутку
    requestAnimationFrame(() => {
      if (scrollWrap.scrollHeight > bodyWrap.clientHeight + 2) {
        p.scroller = makeScroller(bodyWrap, scrollWrap, { padBottom: 8 });
      }
    });
    this.onChange();
    return p;
  }

  close(p, silent = false) {
    if (!p || p.closed) return;
    p.closed = true;
    const i = this.stack.indexOf(p);
    if (i >= 0) this.stack.splice(i, 1);
    p.el.classList.add('closing');
    setTimeout(() => p.el.remove(), 180);
    if (!silent && p.opts.onClose) p.opts.onClose();
    this.onChange();
  }

  closeAll() {
    while (this.stack.length) this.close(this.stack[this.stack.length - 1], true);
  }

  closeById(id) {
    for (const p of this.stack.slice()) if (p.id === id) this.close(p, true);
  }
}
