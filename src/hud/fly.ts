// The little flight a card makes from one place on screen to another: out of the hand onto the
// table, off the table onto a pile. A copy does the travelling; the real element is wherever the
// state says it is.
import type { Rect } from './dom';

export function fly(layer: HTMLElement, node: Element, from: Rect | null, to: Rect | null, { duration = 430, fade = false } = {}): void {
  if (!from || !to || !from.width || !to.width) return;
  const copy = node.cloneNode(true) as HTMLElement;
  copy.removeAttribute('style');
  copy.classList.add('hud-flying');
  copy.style.setProperty('--card-w', from.width + 'px');
  layer.appendChild(copy);
  const done = (): void => copy.remove();
  copy
    .animate(
      [
        { transform: `translate(${from.left}px, ${from.top}px) scale(1)`, opacity: 1 },
        { transform: `translate(${to.left}px, ${to.top}px) scale(${to.width / from.width})`, opacity: fade ? 0.2 : 1 },
      ],
      { duration, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'both' },
    )
    .finished.then(done, done);
}
