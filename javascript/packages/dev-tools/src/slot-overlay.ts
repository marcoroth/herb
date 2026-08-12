export type SlotBoxKind = 'slot' | 'row' | 'element' | 'branch';

interface OpenMarker {
  index: number;
  comment: Comment;
  key?: string;
}

interface SlotBox {
  kind: SlotBoxKind;
  index: number;
  label: string;
  start?: Comment;
  end?: Comment;
  element?: HTMLElement;
}

interface Placement {
  box: SlotBox;
  x: number;
  y: number;
  width: number;
  height: number;
  empty: boolean;
}

const REGION_OPEN = /^herb-region:(.*):([0-9a-f]+)$/;
const SLOT_OPEN = /^herb-slot:(\d+)$/;
const SLOT_CLOSE = /^\/herb-slot:(\d+)$/;
const ROW_OPEN = /^herb-row:(\d+):(.*)$/;
const ROW_CLOSE = /^\/herb-row:(\d+)$/;
const BRANCH = /^herb-branch:(\d+):(\d+)$/;

const OVERSCAN = 1.5;
const SETTLE_MS = 120;
const MAX_BOXES = 2000;

export class SlotOverlay {
  private layer: HTMLElement | null = null;
  private boxes: SlotBox[] = [];
  private regions: string[] = [];
  private visible = false;

  private pool: HTMLElement[] = [];
  private painted: string[] = [];

  private frame = 0;
  private settleTimer = 0;

  private readonly onViewportChange = () => {
    if (this.settleTimer) clearTimeout(this.settleTimer);

    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = 0;
      this.schedule();
    }, SETTLE_MS);
  };

  show() {
    this.visible = true;

    this.ensureLayer();
    this.scan();
    this.draw();

    window.addEventListener('scroll', this.onViewportChange, { passive: true, capture: true });
    window.addEventListener('resize', this.onViewportChange, { passive: true });
  }

  hide() {
    this.visible = false;

    window.removeEventListener('scroll', this.onViewportChange, { capture: true });
    window.removeEventListener('resize', this.onViewportChange);

    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = 0;
    }

    this.layer?.remove();
    this.layer = null;
    this.boxes = [];
    this.pool = [];
    this.painted = [];
  }

  refresh() {
    if (!this.visible) return;

    this.scan();
    this.schedule();
  }

  stats() {
    const counts = { slot: 0, row: 0, element: 0, branch: 0, regions: 0 };

    for (const box of this.boxes) counts[box.kind] += 1;

    counts.regions = new Set(this.regions).size;

    return counts;
  }

  private schedule() {
    if (this.frame || !this.visible) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private ensureLayer() {
    if (this.layer) return;

    this.layer = document.createElement('div');
    this.layer.className = 'herb-slot-layer';

    document.body.appendChild(this.layer);
  }

  private scan() {
    this.boxes = [];
    this.regions = [];

    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT);
    const openSlots: OpenMarker[] = [];
    const openRows: OpenMarker[] = [];

    let comment = walker.nextNode() as Comment | null;

    while (comment) {
      const data = comment.data.trim();

      const region = REGION_OPEN.exec(data);
      if (region) this.regions.push(region[1]);

      const slotOpen = SLOT_OPEN.exec(data);
      if (slotOpen) openSlots.push({ index: Number(slotOpen[1]), comment });

      const slotClose = SLOT_CLOSE.exec(data);
      if (slotClose) {
        const open = this.popMatching(openSlots, Number(slotClose[1]));

        if (open) {
          this.boxes.push({
            kind: 'slot',
            index: open.index,
            label: `slot ${open.index}`,
            start: open.comment,
            end: comment
          });
        }
      }

      const rowOpen = ROW_OPEN.exec(data);
      if (rowOpen) openRows.push({ index: Number(rowOpen[1]), comment, key: rowOpen[2] });

      const rowClose = ROW_CLOSE.exec(data);
      if (rowClose) {
        const open = this.popMatching(openRows, Number(rowClose[1]));

        if (open) {
          this.boxes.push({
            kind: 'row',
            index: open.index,
            label: `key ${open.key}`,
            start: open.comment,
            end: comment
          });
        }
      }

      const branch = BRANCH.exec(data);
      if (branch) {
        this.boxes.push({
          kind: 'branch',
          index: Number(branch[1]),
          label: `branch ${branch[1]}.${branch[2]}`,
          start: comment,
          end: comment
        });
      }

      comment = walker.nextNode() as Comment | null;
    }

    for (const node of document.querySelectorAll('[data-herb-slot]')) {
      const indices = (node.getAttribute('data-herb-slot') || '').split(',').filter(Boolean);

      this.boxes.push({
        kind: 'element',
        index: Number(indices[0] ?? 0),
        label: indices.length > 1 ? `slots ${indices.join(', ')}` : `slot ${indices[0]}`,
        element: node as HTMLElement
      });
    }

    if (this.boxes.length > MAX_BOXES) {
      console.warn(
        `[herb] ${this.boxes.length} slot markers found; drawing the first ${MAX_BOXES}. ` +
        `The rest are omitted to keep the page responsive.`
      );

      this.boxes.length = MAX_BOXES;
    }
  }

  private popMatching(open: OpenMarker[], index: number): OpenMarker | undefined {
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i].index === index) return open.splice(i, 1)[0];
    }

    return undefined;
  }

  private rectFor(box: SlotBox): DOMRect | undefined {
    if (box.element) return box.element.getBoundingClientRect();
    if (!box.start || !box.end) return undefined;

    try {
      const range = document.createRange();

      range.setStartAfter(box.start);
      range.setEndBefore(box.end);

      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
        const parent = box.start.parentElement;

        if (!parent) return undefined;

        const parentRect = parent.getBoundingClientRect();

        return new DOMRect(parentRect.left, parentRect.top, 0, 0);
      }

      return rect;
    } catch {
      return undefined;
    }
  }

  private measure(): Placement[] {
    const placements: Placement[] = [];
    const origin = this.layer!.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = viewportHeight * OVERSCAN;
    const parentRects = new Map<Element, DOMRect>();

    const offScreenParent = (node: Node | null): boolean => {
      if (viewportHeight <= 0) return false;

      const parent = node?.parentElement;
      if (!parent) return false;

      let rect = parentRects.get(parent);

      if (!rect) {
        rect = parent.getBoundingClientRect();
        parentRects.set(parent, rect);
      }

      if (rect.width === 0 && rect.height === 0) return false;

      return rect.bottom < -margin || rect.top > viewportHeight + margin;
    };

    for (const box of this.boxes) {
      if (!box.element && offScreenParent(box.start)) continue;

      const rect = this.rectFor(box);

      if (!rect) continue;
      if (viewportHeight > 0 && (rect.bottom < -margin || rect.top > viewportHeight + margin)) continue;

      const empty = rect.width === 0 && rect.height === 0;

      placements.push({
        box,
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: Math.max(rect.width, empty ? 8 : 0),
        height: Math.max(rect.height, empty ? 14 : 0),
        empty
      });
    }

    return placements;
  }

  private draw() {
    if (!this.layer) return;

    this.paint(this.measure());
  }

  private paint(placements: Placement[]) {
    for (let i = 0; i < placements.length; i++) {
      const placement = placements[i];
      const { box, x, y, width, height, empty } = placement;

      const label = empty ? `${box.label} (empty)` : box.label;
      const key = `${box.kind}|${label}|${Math.round(x)}|${Math.round(y)}|${Math.round(width)}|${Math.round(height)}`;

      if (this.painted[i] === key) continue;

      const node = this.nodeAt(i);
      const text = node.firstChild as HTMLElement;

      node.className = `herb-slot-box herb-slot-box-${box.kind}${empty ? ' herb-slot-box-empty' : ''}`;
      node.style.transform = `translate(${x}px, ${y}px)`;
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
      node.style.display = '';

      if (text.textContent !== label) text.textContent = label;

      this.painted[i] = key;
    }

    for (let i = placements.length; i < this.pool.length; i++) {
      if (this.painted[i] === '') continue;

      this.pool[i].style.display = 'none';
      this.painted[i] = '';
    }
  }

  private nodeAt(index: number): HTMLElement {
    const existing = this.pool[index];

    if (existing) return existing;

    const node = document.createElement('div');
    const label = document.createElement('span');

    label.className = 'herb-slot-box-label';
    node.appendChild(label);

    this.pool[index] = node;
    this.layer!.appendChild(node);

    return node;
  }
}
