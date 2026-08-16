import { SLOT_EVENT } from '@herb-tools/client';
import type { SlotEventDetail } from '@herb-tools/client';

const COLOURS: Record<string, string> = {
  value: '#3b82f6',
  markup: '#3b82f6',
  attribute: '#a855f7',
  branch: '#f59e0b',
  'row-added': '#10b981',
  'row-removed': '#ef4444'
};

/**
 * Says where a slot was written, the way Radiolabel said where CableReady had been.
 *
 * A value update leaves no trace: the page simply says something else than it did a moment ago, and
 * whether that came from the server, from the wrong slot, or from nothing at all is invisible. This
 * puts a box round what changed for as long as it takes to notice.
 *
 * It listens for the runtime's events rather than calling into it, so nothing here has to be loaded
 * for the runtime to work, and an application can listen for the same events itself.
 */
export class SlotFlash {
  private static readonly DURATION = 1600;

  private enabled = false;

  start() {
    if (this.enabled) return;

    this.enabled = true;
    document.addEventListener(SLOT_EVENT, this.draw);
  }

  stop() {
    this.enabled = false;

    document.removeEventListener(SLOT_EVENT, this.draw);
    document.querySelectorAll('.herb-slot-flash').forEach((node) => node.remove());
  }

  private draw = (event: Event) => {
    const detail = (event as CustomEvent<SlotEventDetail>).detail;
    const rect = this.measure(detail);

    if (!rect || (rect.width === 0 && rect.height === 0)) return;

    const colour = COLOURS[detail.operation] ?? '#3b82f6';
    const overlay = document.createElement('div');
    const label = document.createElement('div');

    overlay.className = 'herb-slot-flash';
    label.className = 'herb-slot-flash';

    overlay.style.cssText = `position:absolute;z-index:2147483000;pointer-events:none;top:${rect.top + scrollY}px;left:${rect.left + scrollX}px;width:${rect.width}px;height:${rect.height}px;background:${colour};opacity:0.22;outline:1px solid ${colour};transition:opacity ${SlotFlash.DURATION}ms ease-out;`;

    label.style.cssText = `position:absolute;z-index:2147483001;pointer-events:none;top:${Math.max(0, rect.top + scrollY - 18)}px;left:${rect.left + scrollX}px;background:${colour};color:#fff;font:600 10px/1.6 ui-monospace,monospace;padding:0 5px;border-radius:3px;white-space:nowrap;transition:opacity ${SlotFlash.DURATION}ms ease-out;`;
    label.textContent = this.describe(detail);

    document.body.append(overlay, label);

    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
      label.style.opacity = '0';
    });

    setTimeout(() => {
      overlay.remove();
      label.remove();
    }, SlotFlash.DURATION);
  };

  // The runtime hands over the slot rather than a rectangle, because measuring costs a layout and
  // only something drawing a box actually wants one.
  private measure(detail: SlotEventDetail): DOMRect | null {
    const slot = detail.slot;

    if (!slot) return null;

    if (slot.anchor.kind === 'range') {
      const range = document.createRange();

      range.setStartAfter(slot.anchor.start);
      range.setEndBefore(slot.anchor.end);

      return range.getBoundingClientRect();
    }

    return slot.anchor.element.getBoundingClientRect();
  }

  private describe(detail: SlotEventDetail): string {
    const name = detail.file.split('/').pop() ?? detail.file;
    const where = detail.key === null ? `#${detail.index}` : `#${detail.index}[${detail.key}]`;

    return `${detail.operation} ${name} ${where}`;
  }
}
