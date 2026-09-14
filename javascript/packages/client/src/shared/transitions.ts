export interface TransitionOptions {
  force?: boolean
  type?: string
}

interface Job {
  callback: () => void
  root: ParentNode
  type: string | undefined
  done: () => void
}

interface ViewTransitionLike {
  ready?: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition(): void
}

type StartViewTransition = (update: (() => void) | { update: () => void; types: string[] }) => ViewTransitionLike

type WithViewTransitions = Document & { startViewTransition?: StartViewTransition }

export const TRANSITION_SELECTOR = "[data-herb-transition]"
export const TRANSITION_ATTRIBUTE = "data-herb-transition"

const DEFAULT_NAME = "match-element"

let animating = false
const pending: Job[] = []

export function transitionMutation(callback: () => void, root: ParentNode = document, options: TransitionOptions | boolean = {}): Promise<void> {
  const { force = false, type } = typeof options === "boolean" ? { force: options } : options

  if (!eligible(root, force)) {
    callback()

    return Promise.resolve()
  }

  return new Promise((resolve) => {
    pending.push({ callback, root, type, done: resolve })

    if (!animating) {
      flush()
    }
  })
}

function eligible(root: ParentNode, force: boolean): boolean {
  if (typeof document === "undefined") {
    return false
  }

  const markedRoot = root instanceof Element && root.matches(TRANSITION_SELECTOR)

  if (!force && !markedRoot && !root.querySelector(TRANSITION_SELECTOR)) {
    return false
  }

  if (typeof (document as WithViewTransitions).startViewTransition !== "function") {
    return false
  }

  if (document.visibilityState === "hidden") {
    return false
  }

  if (document.querySelector("dialog:modal")) {
    return false
  }

  for (const popover of document.querySelectorAll(":popover-open")) {
    for (const child of popover.querySelectorAll("*")) {
      if ((child as Element & { checkVisibility?: () => boolean }).checkVisibility?.()) {
        return false
      }
    }
  }

  return true
}

function flush(): void {
  const batch = pending.splice(0)

  if (batch.length === 0) {
    animating = false

    return
  }

  animating = true

  const roots = batch.map((job) => job.root)
  const types = [...new Set(batch.map((job) => job.type).filter((type): type is string => type !== undefined))]
  const start = (document as WithViewTransitions).startViewTransition as StartViewTransition

  setNames(roots, types.length > 0)

  if (!anyEffectiveName(roots)) {
    clearNames()

    for (const job of batch) {
      job.callback()
      job.done()
    }

    flush()

    return
  }

  const style = document.createElement("style")

  style.textContent = `
    @layer herb-transitions {
      ::view-transition-group(*),
      ::view-transition-old(*),
      ::view-transition-new(*) {
        animation-duration: 150ms;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
        animation: none !important;
      }
    }

    ::view-transition-old(root) {
      animation: none !important;
      opacity: 0 !important;
    }

    ::view-transition-new(root) {
      animation: none !important;
      opacity: 1 !important;
    }
  `

  const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content

  if (nonce) {
    style.nonce = nonce
  }

  document.head.appendChild(style)

  const update = () => {
    for (const job of batch) {
      job.callback()
      job.done()
    }

    setNames(roots, types.length > 0)
  }

  let transition: ViewTransitionLike

  try {
    transition = startWithTypes(start, update, types)
  } catch {
    style.remove()
    clearNames()

    for (const job of batch) {
      job.callback()
      job.done()
    }

    flush()

    return
  }

  transition.ready?.catch(() => {})
  skipUnderTopLayer(transition)
  skipWhenHidden(transition)

  transition.finished.finally(() => {
    style.remove()
    clearNames()
    flush()
  }).catch(() => {})
}

function startWithTypes(start: StartViewTransition, update: () => void, types: string[]): ViewTransitionLike {
  if (types.length === 0) {
    return start.call(document, update)
  }

  try {
    return start.call(document, { update, types })
  } catch {
    return start.call(document, update)
  }
}

function markedIn(roots: ParentNode[]): HTMLElement[] {
  const found: HTMLElement[] = []

  for (const root of roots) {
    if (root instanceof HTMLElement && root.matches(TRANSITION_SELECTOR)) {
      found.push(root)
    }

    found.push(...root.querySelectorAll<HTMLElement>(TRANSITION_SELECTOR))
  }

  return found
}

function anyEffectiveName(roots: ParentNode[]): boolean {
  return markedIn(roots).some((element) => getComputedStyle(element).viewTransitionName !== "none")
}

function setNames(roots: ParentNode[], typed = false): void {
  for (const root of roots) {
    const marked = [...root.querySelectorAll<HTMLElement>(TRANSITION_SELECTOR)]

    if (root instanceof HTMLElement && root.matches(TRANSITION_SELECTOR)) {
      marked.unshift(root)
    }

    for (const element of marked) {
      if (element.style.viewTransitionName) {
        continue
      }

      const name = element.getAttribute(TRANSITION_ATTRIBUTE)

      if (!name && typed) {
        continue
      }

      element.style.viewTransitionName = name ? identifier(name) : DEFAULT_NAME
    }
  }
}

function clearNames(): void {
  for (const element of document.querySelectorAll<HTMLElement>(TRANSITION_SELECTOR)) {
    element.style.viewTransitionName = ""
  }
}

export function transitionIdentifier(name: string): string {
  return identifier(name)
}

function identifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-")
}

function skipWhenHidden(transition: ViewTransitionLike): void {
  const onHidden = () => {
    if (document.visibilityState === "hidden") {
      transition.skipTransition()
    }
  }

  document.addEventListener("visibilitychange", onHidden)

  transition.finished.finally(() => {
    document.removeEventListener("visibilitychange", onHidden)
  }).catch(() => {})
}

function skipUnderTopLayer(transition: ViewTransitionLike): void {
  const onBeforeToggle = (event: Event) => {
    const toggle = event as Event & { newState?: string }

    if (toggle.newState === "open" && (event.target as Element | null)?.matches?.("dialog, [popover]")) {
      transition.skipTransition()
    }
  }

  document.addEventListener("beforetoggle", onBeforeToggle, true)

  const observer = new MutationObserver(() => {
    if (document.querySelector("dialog:modal")) {
      transition.skipTransition()
      observer.disconnect()
    }
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["open"], subtree: true })

  transition.finished.finally(() => {
    observer.disconnect()
    document.removeEventListener("beforetoggle", onBeforeToggle, true)
  }).catch(() => {})
}
