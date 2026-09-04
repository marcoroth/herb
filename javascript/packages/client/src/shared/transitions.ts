export const TRANSITION_SELECTOR = "[data-herb-transition]"
export const TRANSITION_ATTRIBUTE = "data-herb-transition"

const DEFAULT_NAME = "match-element"

interface Job {
  callback: () => void
  root: ParentNode
  done: () => void
}

let animating = false
const pending: Job[] = []

// Runs a DOM mutation inside a view transition when the page opts in.
//
// An element carrying `data-herb-transition` names itself for the browser's
// View Transitions API right before the mutation and unnames itself after,
// so no permanent stacking contexts accumulate. A bare attribute uses the
// `match-element` keyword, which auto-names each element, and a value names
// the transition for the page's own `::view-transition-*` CSS. The root
// crossfade stays disabled, so only marked elements animate.
//
// Transitions serialize. Starting one while another animates would skip the
// running animation mid-flight, so concurrent mutations queue and flush
// together as one following transition. Naming stays scoped to each
// mutation's own subtree, so unrelated marked elements never freeze into
// snapshot groups for a change that cannot touch them.
//
// The mutation itself always runs. A page without marked elements, a browser
// without the API, a reduced-motion preference, or an open modal dialog or
// visible popover all skip the animation and nothing else. The pseudo-elements
// paint above the top layer, so animating behind one would flash over it.
export function transitionMutation(callback: () => void, root: ParentNode = document, force = false): Promise<void> {
  if (!eligible(root, force)) {
    callback()

    return Promise.resolve()
  }

  return new Promise((resolve) => {
    pending.push({ callback, root, done: resolve })

    if (!animating) {
      flush()
    }
  })
}

// `force` says the mutation brings marked content the page does not hold yet,
// like a branch mounting from parked statics, so the marked-element check
// cannot see it and is skipped.
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
  const start = (document as WithViewTransitions).startViewTransition as (update: () => void) => ViewTransitionLike

  setNames(roots)

  // CSS gets the last word on participation. A marked element whose computed
  // view-transition-name stays `none`, through a media query saying
  // `view-transition-name: none !important`, is turned off for that layout,
  // and a batch whose marked elements are all turned off mutates without a
  // transition, so no capture ever freezes the page for it.
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

  document.head.appendChild(style)

  const update = () => {
    for (const job of batch) {
      job.callback()
      job.done()
    }

    setNames(roots)
  }

  const transition = start.call(document, update)

  transition.ready?.catch(() => {})
  skipUnderTopLayer(transition)

  transition.finished.finally(() => {
    style.remove()
    clearNames()
    flush()
  }).catch(() => {})
}

type WithViewTransitions = Document & { startViewTransition?: (update: () => void) => ViewTransitionLike }

interface ViewTransitionLike {
  ready?: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition(): void
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

function setNames(roots: ParentNode[]): void {
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

      element.style.viewTransitionName = name ? identifier(name) : DEFAULT_NAME
    }
  }
}

function clearNames(): void {
  for (const element of document.querySelectorAll<HTMLElement>(TRANSITION_SELECTOR)) {
    element.style.viewTransitionName = ""
  }
}

function identifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-")
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
