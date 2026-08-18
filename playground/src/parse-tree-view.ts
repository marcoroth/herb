import Prism from "prismjs"

const LOCATION_PATTERN = /\(location:\s*\((\d+):(\d+)\)-\((\d+):(\d+)\)\)/
const NODE_LINE_PATTERN = /@ [A-Za-z]+(?:Node|Error)\b/
const OVERSCAN = 20
const FALLBACK_LINE_HEIGHT = 21

type TreeLine = {
  index: number
  plain: string
  html: string | null
  depth: number
  isNode: boolean
  location: [number, number, number, number] | null
  collapsed: boolean
}

export type TreeLocation = {
  location: [number, number, number, number]
  lineIndex: number
}

export type ParseTreeCallbacks = {
  onHoverLocation?: (location: [number, number, number, number], isError: boolean) => void
  onLeaveLocation?: () => void
}


function depthOf(plainLine: string): number {
  const match = plainLine.match(/[A-Za-z@]/)

  if (!match) return 9999

  return Math.floor((match.index ?? 0) / 4)
}

function locationOf(plainLine: string): [number, number, number, number] | null {
  const match = plainLine.match(LOCATION_PATTERN)

  if (!match) return null

  return [Number(match[1]), Number(match[2]) + 1, Number(match[3]), Number(match[4]) + 1]
}

export class ParseTreeView {
  #container: HTMLElement
  #scroller: HTMLElement | null
  #lines: TreeLine[] = []
  #visible: number[] = []
  #lineHeight = FALLBACK_LINE_HEIGHT
  #renderedFrom = -1
  #renderedTo = -1
  #onHoverLocation?: ParseTreeCallbacks["onHoverLocation"]
  #onLeaveLocation?: ParseTreeCallbacks["onLeaveLocation"]
  #handleScroll: () => void
  #source: string | null = null

  constructor(container: HTMLElement, { onHoverLocation, onLeaveLocation }: ParseTreeCallbacks = {}) {
    this.#container = container
    this.#scroller = this.#scrollerFor(container)
    this.#onHoverLocation = onHoverLocation
    this.#onLeaveLocation = onLeaveLocation

    this.#handleScroll = () => this.#renderWindow()

    this.#scroller?.addEventListener("scroll", this.#handleScroll, { passive: true })
    window.addEventListener("resize", this.#handleScroll, { passive: true })

    this.#attachDelegates()
  }

  #scrollerFor(element: HTMLElement): HTMLElement | null {
    let node = element.parentElement

    while (node && node !== document.body) {
      const overflow = getComputedStyle(node).overflowY

      if (overflow === "auto" || overflow === "scroll") return node

      node = node.parentElement
    }

    return null
  }

  get locations(): TreeLocation[] {
    return this.#lines
      .filter((line): line is TreeLine & { location: [number, number, number, number] } => line.location !== null)
      .map(line => ({ location: line.location, lineIndex: line.index }))
  }

  render(tree: string): void {
    if (this.#source === tree) return

    this.#source = tree
    this.#container.classList.add("language-tree")

    this.#lines = tree.split("\n").map((plain, index) => ({
      index,
      plain,
      html: null,
      depth: depthOf(plain),
      isNode: NODE_LINE_PATTERN.test(plain),
      location: locationOf(plain),
      collapsed: false,
    }))

    this.#recomputeVisible()
    this.#renderWindow(true)
  }

  #recomputeVisible(): void {
    const visible = []
    let hiddenBelowDepth = null

    for (const line of this.#lines) {
      if (hiddenBelowDepth !== null && line.depth > hiddenBelowDepth) continue

      hiddenBelowDepth = null
      visible.push(line.index)

      if (line.collapsed) hiddenBelowDepth = line.depth
    }

    this.#visible = visible
  }

  #renderWindow(force = false): void {
    if (!this.#visible.length) {
      this.#container.replaceChildren()
      this.#renderedFrom = this.#renderedTo = -1

      return
    }

    const viewportHeight = this.#scroller?.clientHeight ?? this.#container.clientHeight
    const offset = this.#scrollOffset()

    const first = Math.max(0, Math.floor(offset / this.#lineHeight) - OVERSCAN)
    const count = Math.ceil(viewportHeight / this.#lineHeight) + OVERSCAN * 2
    const last = Math.min(this.#visible.length, first + count)

    if (!force && first === this.#renderedFrom && last === this.#renderedTo) return

    this.#renderedFrom = first
    this.#renderedTo = last

    const top = document.createElement("div")
    top.style.height = `${first * this.#lineHeight}px`

    const bottom = document.createElement("div")
    bottom.style.height = `${(this.#visible.length - last) * this.#lineHeight}px`

    const fragment = document.createDocumentFragment()
    fragment.appendChild(top)

    let html = ""

    for (let position = first; position < last; position++) {
      const line = this.#lines[this.#visible[position]]
      const classes = line.isNode ? "tree-line tree-collapsible" : "tree-line"
      const toggle = line.isNode
        ? `<span class="tree-toggle" data-collapsed="${line.collapsed}"></span>`
        : ""

      line.html ??= Prism.highlight(line.plain, Prism.languages.tree, "tree")

      html += `<span class="${classes}" data-depth="${line.depth}" data-line-index="${line.index}">${toggle}${line.html}</span>`
    }

    const holder = document.createElement("div")
    holder.innerHTML = html

    while (holder.firstChild) fragment.appendChild(holder.firstChild)

    fragment.appendChild(bottom)

    this.#container.replaceChildren(fragment)
    this.#measureLineHeight()
    this.#decorate()
  }

  #scrollOffset(): number {
    if (!this.#scroller) return 0

    const containerTop = this.#container.getBoundingClientRect().top
    const scrollerTop = this.#scroller.getBoundingClientRect().top

    return Math.max(0, scrollerTop - containerTop)
  }

  #measureLineHeight(): void {
    const line = this.#container.querySelector(".tree-line")

    if (!line) return

    const height = line.getBoundingClientRect().height

    if (height > 0) this.#lineHeight = height
  }

  #decorate(): void {
    this.#container.querySelectorAll<HTMLElement>(".tree-collapsible .token.node, .tree-collapsible .token.error-class").forEach(token => {
      token.dataset.name = (token.textContent ?? "").replace(/^@ /, "")
      token.dataset.prefix = (token.closest(".tree-line")?.querySelector(".tree-toggle") as HTMLElement | null)?.dataset.collapsed === "true" ? "-" : "@"
    })

    this.#container.querySelectorAll<HTMLElement>(".token.location").forEach(token => {
      token.classList.add("hover-highlight")
      token.previousElementSibling?.classList.add("hover-highlight")
    })
  }

  #attachDelegates(): void {
    this.#container.addEventListener("click", (event: MouseEvent) => {
      const toggle = (event.target as HTMLElement).closest(".tree-toggle")
      const token = toggle ? null : (event.target as HTMLElement).closest(".tree-collapsible .token.node, .tree-collapsible .token.error-class")
      const target = toggle || token

      if (!target) return

      event.preventDefault()
      event.stopPropagation()

      this.#toggleLine(Number((target.closest(".tree-line") as HTMLElement).dataset.lineIndex))
    })

    this.#container.addEventListener("mouseover", (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest(".hover-highlight")

      if (!target) return

      const lineElement = target.closest(".tree-line")

      if (!lineElement) return

      const line = this.#lines[Number((lineElement as HTMLElement).dataset.lineIndex)]

      if (!line?.location) return

      this.#onHoverLocation?.(line.location, target.classList.contains("error-class"))
    })

    this.#container.addEventListener("mouseleave", () => this.#onLeaveLocation?.())
  }

  #toggleLine(index: number): void {
    const line = this.#lines[index]

    if (!line?.isNode) return

    line.collapsed = !line.collapsed

    this.#recomputeVisible()
    this.#renderWindow(true)
  }

  expandAll(): void {
    this.#lines.forEach(line => { line.collapsed = false })
    this.#recomputeVisible()
    this.#renderWindow(true)
  }

  collapseAll(): void {
    this.#lines.forEach(line => { line.collapsed = line.isNode && line.depth > 0 })
    this.#recomputeVisible()
    this.#renderWindow(true)
  }

  revealLine(index: number): HTMLElement | null {
    for (const line of this.#lines) {
      if (line.depth < this.#lines[index]?.depth && line.index < index) line.collapsed = false
    }

    this.#recomputeVisible()

    const position = this.#visible.indexOf(index)

    if (position === -1) return null

    if (this.#scroller) {
      const target = position * this.#lineHeight
      const containerOffset = this.#container.offsetTop - ((this.#scroller.firstElementChild as HTMLElement | null)?.offsetTop ?? 0)

      this.#scroller.scrollTop = Math.max(0, containerOffset + target - this.#scroller.clientHeight / 2)
    }

    this.#renderWindow(true)

    return this.#container.querySelector<HTMLElement>(`.tree-line[data-line-index="${index}"]`)
  }

  highlightLine(index: number): Element | null | undefined {
    this.#container.querySelectorAll(".tree-location-highlight").forEach(element => {
      element.classList.remove("tree-location-highlight")
    })

    const element = this.#container.querySelector(`.tree-line[data-line-index="${index}"] .token.location`)

    element?.classList.add("tree-location-highlight")

    return element
  }

  clearHighlights(): void {
    this.#container.querySelectorAll(".tree-location-highlight").forEach(element => {
      element.classList.remove("tree-location-highlight")
    })
  }

  get text(): string {
    return this.#source ?? ""
  }

  dispose(): void {
    this.#scroller?.removeEventListener("scroll", this.#handleScroll)
    window.removeEventListener("resize", this.#handleScroll)
  }
}
