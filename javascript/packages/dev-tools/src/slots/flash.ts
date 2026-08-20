import { SLOT_EVENT } from '@herb-tools/client'
import type { Slot, SlotEventDetail, SlotOperation } from '@herb-tools/client'

const COLORS: Record<SlotOperation, string> = {
  value: '#3b82f6',
  markup: '#3b82f6',
  attribute: '#a855f7',
  branch: '#f59e0b',
  'item-added': '#10b981',
  'item-removed': '#ef4444',
  'item-updated': '#0ea5e9'
}

export class SlotFlash {
  private static readonly DURATION = 1600

  private enabled = false

  start() {
    if (this.enabled) return

    this.enabled = true
    document.addEventListener(SLOT_EVENT, this.draw)
  }

  stop() {
    this.enabled = false

    document.removeEventListener(SLOT_EVENT, this.draw)
    document.querySelectorAll('.herb-slot-flash').forEach((node) => node.remove())
  }

  private draw = (event: Event) => {
    const detail = (event as CustomEvent<SlotEventDetail>).detail

    if (detail.operation === 'item-removed') {
      this.paint(detail)

      return
    }

    setTimeout(() => this.paint(detail), 0)
  }

  private paint(detail: SlotEventDetail): void {
    if (!this.enabled) return

    const rect = this.measure(detail)

    if (!rect) return

    const colour = COLORS[detail.operation] ?? '#3b82f6'
    const overlay = document.createElement('div')
    const label = document.createElement('div')

    overlay.className = 'herb-slot-flash'
    label.className = 'herb-slot-flash'

    overlay.style.cssText = `position:absolute;z-index:2147483000;pointer-events:none;top:${rect.top + scrollY}px;left:${rect.left + scrollX}px;width:${rect.width}px;height:${rect.height}px;background:${colour};opacity:0.22;outline:1px solid ${colour};transition:opacity ${SlotFlash.DURATION}ms ease-out`

    label.style.cssText = `position:absolute;z-index:2147483001;pointer-events:none;top:${Math.max(0, rect.top + scrollY - 18)}px;left:${rect.left + scrollX}px;background:${colour};color:#fff;font:600 10px/1.6 ui-monospace,monospace;padding:0 5px;border-radius:3px;white-space:nowrap;transition:opacity ${SlotFlash.DURATION}ms ease-out`
    label.textContent = this.describe(detail)

    document.body.append(overlay, label)

    const drawn = [overlay, label]
    const around = detail.item ? this.measureSlot(detail.slot) : null

    if (around) {
      const box = document.createElement('div')

      box.className = 'herb-slot-flash herb-slot-flash-collection'
      box.style.cssText = `position:absolute;z-index:2147482999;pointer-events:none;top:${around.top + scrollY}px;left:${around.left + scrollX}px;width:${around.width}px;height:${around.height}px;background:transparent;outline:2px dashed ${colour};outline-offset:3px;transition:opacity ${SlotFlash.DURATION}ms ease-out`

      document.body.append(box)
      drawn.push(box)
    }

    requestAnimationFrame(() => drawn.forEach((node) => (node.style.opacity = '0')))

    setTimeout(() => drawn.forEach((node) => node.remove()), SlotFlash.DURATION)
  }

  private measure(detail: SlotEventDetail): DOMRect | null {
    if (detail.item) {
      const range = document.createRange()

      range.setStartBefore(detail.item.start)
      range.setEndAfter(detail.item.end)

      return this.biggest(range.getBoundingClientRect())
    }

    return this.measureSlot(detail.slot)
  }

  private measureSlot(slot: Slot | null): DOMRect | null {
    if (!slot) return null

    if (slot.anchor.kind === 'range') {
      const range = document.createRange()

      range.setStartAfter(slot.anchor.start)
      range.setEndBefore(slot.anchor.end)

      return this.biggest(range.getBoundingClientRect())
    }

    const element = slot.anchor.element
    const rect = this.biggest(element.getBoundingClientRect())

    if (rect) return rect

    const contents = document.createRange()

    contents.selectNodeContents(element)

    return this.biggest(contents.getBoundingClientRect()) ?? this.biggest(element.parentElement?.getBoundingClientRect())
  }

  private biggest(rect: DOMRect | undefined): DOMRect | null {
    if (!rect) return null

    return rect.width > 0 || rect.height > 0 ? rect : null
  }

  private describe(detail: SlotEventDetail): string {
    const name = detail.file.split('/').pop() ?? detail.file
    const key = detail.key === null ? '' : ` (${detail.key})`
    const attribute = detail.slot?.attribute ? ` [${detail.slot.attribute}]` : ''

    return `${detail.operation} ${name} #${detail.index}${key}${attribute}`
  }
}
