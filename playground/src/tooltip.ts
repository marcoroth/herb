export class Tooltip {
  #trigger: HTMLElement | null
  #tooltip: HTMLElement | null
  #show = () => this.show()
  #hide = () => this.hide()

  constructor(trigger: HTMLElement | null, tooltip: HTMLElement | null) {
    this.#trigger = trigger
    this.#tooltip = tooltip
  }

  get available(): boolean {
    return !!this.#trigger && !!this.#tooltip
  }

  attach(): void {
    if (!this.available) return

    this.#trigger!.addEventListener("mouseenter", this.#show)
    this.#trigger!.addEventListener("mouseleave", this.#hide)
  }

  detach(): void {
    if (!this.available) return

    this.#trigger!.removeEventListener("mouseenter", this.#show)
    this.#trigger!.removeEventListener("mouseleave", this.#hide)

    this.hide()
  }

  show(): void {
    this.#tooltip?.classList.remove("hidden")
  }

  hide(): void {
    this.#tooltip?.classList.add("hidden")
  }

  setText(text: string): void {
    const textNode = this.#tooltip?.firstChild

    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = text
    }
  }
}

export class FloatingTooltip {
  #trigger: HTMLElement | null
  #id: string
  #text: string | null = null
  #show = () => this.show()
  #hide = () => this.hide()

  constructor(trigger: HTMLElement | null, id: string) {
    this.#trigger = trigger
    this.#id = id
  }

  get available(): boolean {
    return !!this.#trigger
  }

  attach(): void {
    if (!this.#trigger) return

    this.#trigger.addEventListener("mouseenter", this.#show)
    this.#trigger.addEventListener("mouseleave", this.#hide)
  }

  detach(): void {
    if (!this.#trigger) return

    this.#trigger.removeEventListener("mouseenter", this.#show)
    this.#trigger.removeEventListener("mouseleave", this.#hide)

    this.hide()
  }

  show(): void {
    if (!this.#text || !this.#trigger) return

    this.hide()

    const rect = this.#trigger.getBoundingClientRect()
    const tooltip = document.createElement("div")

    tooltip.id = this.#id
    tooltip.className = "fixed px-2 py-1 text-xs text-white bg-black rounded-md whitespace-nowrap z-[9999] pointer-events-none"
    tooltip.textContent = this.#text

    tooltip.style.left = `${rect.left + (rect.width / 2)}px`
    tooltip.style.top = `${rect.top - 8}px`
    tooltip.style.transform = "translate(-50%, -100%)"

    document.body.appendChild(tooltip)
  }

  hide(): void {
    document.getElementById(this.#id)?.remove()
  }

  setText(text: string): void {
    this.#text = text
  }
}

export class TooltipRegistry {
  #tooltips = new Map<string, Tooltip | FloatingTooltip>()

  add(name: string, trigger: HTMLElement | null, tooltip: HTMLElement | null): void {
    this.#tooltips.set(name, new Tooltip(trigger, tooltip))
  }

  addFloating(name: string, trigger: HTMLElement | null, id: string): void {
    this.#tooltips.set(name, new FloatingTooltip(trigger, id))
  }

  get(name: string): Tooltip | FloatingTooltip | undefined {
    return this.#tooltips.get(name)
  }

  attach(name: string): void {
    this.#tooltips.get(name)?.attach()
  }

  detach(name: string): void {
    this.#tooltips.get(name)?.detach()
  }

  setText(name: string, text: string): void {
    this.#tooltips.get(name)?.setText(text)
  }

  attachAll(): void {
    this.#tooltips.forEach(tooltip => tooltip.attach())
  }

  detachAll(): void {
    this.#tooltips.forEach(tooltip => tooltip.detach())
  }
}
