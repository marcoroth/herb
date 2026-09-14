import { SLOT_EVENT } from '@herb-tools/client'
import type { Slot, SlotEventDetail, SlotOperation } from '@herb-tools/client'

const COLORS: Partial<Record<SlotOperation, string>> = {
  value: '#3b82f6',
  attribute: '#a855f7',
  branch: '#f59e0b',
  keyed: '#ec4899',
  'item-added': '#10b981',
  'item-removed': '#ef4444',
  'item-updated': '#0ea5e9',
  'item-rekeyed': '#14b8a6'
}

export const ELEMENT_FLASH_COLOUR = '#f59e0b'
const ELEMENT_FLASH_DURATION = 1600

export function flashElement(element: Element, colour = ELEMENT_FLASH_COLOUR): HTMLElement | null {
  if (!element.isConnected) return null

  const rect = element.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) return null

  const overlay = document.createElement('div')

  overlay.className = 'herb-slot-flash herb-element-flash'
  overlay.style.cssText = `position:absolute;z-index:2147483000;pointer-events:none;top:${rect.top + window.scrollY}px;left:${rect.left + window.scrollX}px;width:${rect.width}px;height:${rect.height}px;background:${colour};opacity:0.22;outline:2px solid ${colour};outline-offset:2px;transition:opacity ${ELEMENT_FLASH_DURATION}ms ease-out`

  document.body.appendChild(overlay)

  requestAnimationFrame(() => { overlay.style.opacity = '0' })
  setTimeout(() => overlay.remove(), ELEMENT_FLASH_DURATION)

  return overlay
}

export const FLASH_HOLD_EVENT = 'herb:flash-hold'
export const FLASH_RELEASE_EVENT = 'herb:flash-release'
export const STATIC_FLASH_EVENT = 'herb:static-update'
export const STATIC_REMOVED_EVENT = 'herb:static-removed'

export interface FlashRect { top: number; left: number; width: number; height: number }

const STATIC_FLASH_COLOUR = '#f97316'
const REMOVED_FLASH_COLOUR = '#ef4444'

const HOLD_FAILSAFE = 5000

export class HotReloadFlash {
  private enabled = false
  private held: { node?: Node; rect?: FlashRect }[] | null = null
  private failsafe: ReturnType<typeof setTimeout> | null = null

  start() {
    if (this.enabled) return

    this.enabled = true
    document.addEventListener(STATIC_FLASH_EVENT, this.draw)
    document.addEventListener(STATIC_REMOVED_EVENT, this.drawRemoved)
    document.addEventListener(FLASH_HOLD_EVENT, this.hold)
    document.addEventListener(FLASH_RELEASE_EVENT, this.release)
  }

  stop() {
    this.enabled = false
    this.held = null

    if (this.failsafe) {
      clearTimeout(this.failsafe)
      this.failsafe = null
    }

    document.removeEventListener(STATIC_FLASH_EVENT, this.draw)
    document.removeEventListener(STATIC_REMOVED_EVENT, this.drawRemoved)
    document.removeEventListener(FLASH_HOLD_EVENT, this.hold)
    document.removeEventListener(FLASH_RELEASE_EVENT, this.release)
  }

  private hold = () => {
    this.held = []

    if (this.failsafe) clearTimeout(this.failsafe)

    this.failsafe = setTimeout(() => this.release(), 5000)
  }

  private release = () => {
    const held = this.held
    const seen = new Set<Node>()

    this.held = null

    if (this.failsafe) {
      clearTimeout(this.failsafe)
      this.failsafe = null
    }

    if (!held) return

    for (const entry of held) {
      if (entry.node) {
        if (seen.has(entry.node)) continue

        seen.add(entry.node)
        this.paint(entry.node)
      } else if (entry.rect) {
        this.paintRect(entry.rect, 'removed', REMOVED_FLASH_COLOUR)
      }
    }
  }

  private draw = (event: Event) => {
    if (!this.enabled) return

    const node = (event as CustomEvent<{ node?: Node }>).detail?.node

    if (!node) return

    if (this.held) {
      this.held.push({ node })

      return
    }

    this.paint(node)
  }

  private drawRemoved = (event: Event) => {
    if (!this.enabled) return

    const rect = (event as CustomEvent<{ rect?: FlashRect }>).detail?.rect

    if (!rect || rect.width * rect.height === 0) return

    if (this.held) {
      this.held.push({ rect })

      return
    }

    this.paintRect(rect, 'removed', REMOVED_FLASH_COLOUR)
  }

  private paint = (node: Node) => {
    if (!this.enabled) return

    const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement

    if (!element || !element.isConnected) return

    const rect = element.getBoundingClientRect()

    this.paintRect(rect, 'hot reload', STATIC_FLASH_COLOUR)
  }

  private paintRect = (rect: FlashRect, caption: string, colour: string) => {
    if (!this.enabled) return

    if (rect.width === 0 && rect.height === 0) return

    if (rect.width * rect.height > innerWidth * innerHeight * 0.6) return

    const overlay = document.createElement('div')
    const label = document.createElement('div')

    overlay.className = 'herb-slot-flash'
    label.className = 'herb-slot-flash'

    overlay.style.cssText = `position:absolute;z-index:2147483000;pointer-events:none;top:${rect.top + scrollY}px;left:${rect.left + scrollX}px;width:${rect.width}px;height:${rect.height}px;background:${colour};opacity:0.22;outline:1px solid ${colour};transition:opacity ${1600}ms ease-out`

    label.style.cssText = `position:absolute;z-index:2147483001;pointer-events:none;top:${Math.max(0, rect.top + scrollY - 18)}px;left:${rect.left + scrollX}px;background:${colour};color:#fff;font:600 10px/1.6 ui-monospace,monospace;padding:0 5px;border-radius:3px;white-space:nowrap;transition:opacity ${1600}ms ease-out`
    label.textContent = caption

    document.body.append(overlay, label)

    requestAnimationFrame(() => { overlay.style.opacity = '0'; label.style.opacity = '0' })
    setTimeout(() => { overlay.remove(); label.remove() }, 1600)
  }

}

export class SlotFlash {
  private static readonly DURATION = 1600

  private enabled = false
  private held: { detail: SlotEventDetail; rect: DOMRect | null }[] | null = null
  private failsafe: ReturnType<typeof setTimeout> | null = null

  start() {
    if (this.enabled) return

    this.enabled = true
    document.addEventListener(SLOT_EVENT, this.draw)
    document.addEventListener(FLASH_HOLD_EVENT, this.hold)
    document.addEventListener(FLASH_RELEASE_EVENT, this.release)
  }

  stop() {
    this.enabled = false
    this.held = null

    if (this.failsafe) {
      clearTimeout(this.failsafe)
      this.failsafe = null
    }

    document.removeEventListener(SLOT_EVENT, this.draw)
    document.removeEventListener(FLASH_HOLD_EVENT, this.hold)
    document.removeEventListener(FLASH_RELEASE_EVENT, this.release)
    document.querySelectorAll('.herb-slot-flash').forEach((node) => node.remove())
  }

  private hold = () => {
    this.held = []

    if (this.failsafe) clearTimeout(this.failsafe)

    this.failsafe = setTimeout(() => this.release(new CustomEvent(FLASH_RELEASE_EVENT)), HOLD_FAILSAFE)
  }

  private release = (event: Event) => {
    const changed = (event as CustomEvent<{ changed?: (detail: SlotEventDetail) => boolean }>).detail?.changed
    const held = this.held ?? []

    this.held = null

    if (this.failsafe) {
      clearTimeout(this.failsafe)
      this.failsafe = null
    }

    for (const entry of held) {
      if (!changed || changed(entry.detail)) {
        this.paint(entry.detail, entry.rect)
      }
    }
  }

  private draw = (event: Event) => {
    const detail = (event as CustomEvent<SlotEventDetail>).detail

    if (detail.operation === 'built') return

    if (this.held) {
      this.held.push({ detail, rect: detail.operation === 'item-removed' ? this.measure(detail) : null })

      return
    }

    if (detail.operation === 'item-removed') {
      this.paint(detail)

      return
    }

    setTimeout(() => this.paint(detail), 0)
  }

  private paint(detail: SlotEventDetail, measured: DOMRect | null = null): void {
    if (!this.enabled) return

    const rect = measured ?? this.measure(detail)

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
