interface FieldState {
  key: string
  value?: string
  checked?: boolean
  selectedIndex?: number
  focused: boolean
  selectionStart: number | null
  selectionEnd: number | null
  selectionDirection: "forward" | "backward" | "none" | null
}

interface OpenState {
  key: string
  open: boolean
}

interface ScrollState {
  key: string
  top: number
  left: number
}

export interface CapturedUserState {
  fields: FieldState[]
  toggles: OpenState[]
  scrolls: ScrollState[]
}

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function elementsWithin(range: Range): Element[] {
  const root = range.commonAncestorContainer
  const scope = root instanceof Element ? root : root.parentElement

  if (!scope) {
    return []
  }

  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })

  const found: Element[] = []
  let current: Node | null

  while ((current = walker.nextNode())) {
    found.push(current as Element)
  }

  return found
}

function keyFor(element: Element, seen: Map<string, number>): string {
  const name = element.getAttribute("name") || element.id || element.tagName.toLowerCase()
  const offset = seen.get(name) ?? 0

  seen.set(name, offset + 1)

  return `${name}#${offset}`
}

function formControl(element: Element): element is FormControl {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
}

function diverged(element: FormControl): boolean {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return element.checked !== element.defaultChecked
    }

    return element.value !== element.defaultValue
  }

  if (element instanceof HTMLTextAreaElement) {
    return element.value !== element.defaultValue
  }

  return [...element.options].some((option) => option.selected !== option.defaultSelected)
}

function selectable(element: FormControl): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) {
    return true
  }

  return element instanceof HTMLInputElement && ["text", "search", "url", "tel", "password"].includes(element.type)
}

export function captureUserState(range: Range, stateBound: Set<Element> = new Set()): CapturedUserState {
  const captured: CapturedUserState = { fields: [], toggles: [], scrolls: [] }
  const seen = new Map<string, number>()
  const active = document.activeElement

  for (const element of elementsWithin(range)) {
    const key = keyFor(element, seen)

    if (formControl(element)) {
      const focused = element === active
      const bound = stateBound.has(element)

      if (focused || (!bound && diverged(element))) {
        const field: FieldState = {
          key,
          focused,
          selectionStart: null,
          selectionEnd: null,
          selectionDirection: null,
        }

        if (bound) {
          /* state owns the value, the capture only carries the caret */
        } else if (element instanceof HTMLSelectElement) {
          field.selectedIndex = element.selectedIndex
        } else if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          field.checked = element.checked
        } else {
          field.value = element.value
        }

        if (focused && selectable(element)) {
          field.selectionStart = element.selectionStart
          field.selectionEnd = element.selectionEnd
          field.selectionDirection = element.selectionDirection
        }

        captured.fields.push(field)
      }
    }

    if (element instanceof HTMLDetailsElement || element instanceof HTMLDialogElement) {
      captured.toggles.push({ key, open: element.open })
    }

    if (element.scrollTop !== 0 || element.scrollLeft !== 0) {
      captured.scrolls.push({ key, top: element.scrollTop, left: element.scrollLeft })
    }
  }

  return captured
}

export function restoreUserState(range: Range, captured: CapturedUserState): number {
  const seen = new Map<string, number>()
  const byKey = new Map<string, Element>()

  for (const element of elementsWithin(range)) {
    byKey.set(keyFor(element, seen), element)
  }

  let restored = 0

  for (const field of captured.fields) {
    const element = byKey.get(field.key)

    if (!element || !formControl(element)) {
      continue
    }

    if (field.selectedIndex !== undefined && element instanceof HTMLSelectElement) {
      element.selectedIndex = field.selectedIndex
    } else if (field.checked !== undefined && element instanceof HTMLInputElement) {
      element.checked = field.checked
    } else if (field.value !== undefined && !(element instanceof HTMLSelectElement)) {
      element.value = field.value
    }

    if (field.focused) {
      element.focus()

      if (field.selectionStart !== null && selectable(element)) {
        element.setSelectionRange(field.selectionStart, field.selectionEnd, field.selectionDirection ?? undefined)
      }
    }

    restored += 1
  }

  for (const toggle of captured.toggles) {
    const element = byKey.get(toggle.key)

    if (element instanceof HTMLDetailsElement || element instanceof HTMLDialogElement) {
      element.open = toggle.open

      restored += 1
    }
  }

  for (const scroll of captured.scrolls) {
    const element = byKey.get(scroll.key)

    if (element) {
      element.scrollTop = scroll.top
      element.scrollLeft = scroll.left

      restored += 1
    }
  }

  return restored
}
