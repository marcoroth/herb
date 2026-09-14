import { ANSI_VARIABLE_PREFIX, ANSIConverter } from "./ansi-html.js"

import type { LinkResolver } from "./ansi-html.js"

import { BACKGROUND, FOREGROUND } from "../themes/onedark.json" with { type: "json" }

export const HERB_ANSI_TAG_NAME = "herb-ansi"
export const HERB_ANSI_FONT_STACK = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`

export interface ANSISurface {
  background: string
  foreground: string
}

export const HERB_ANSI_SURFACE: ANSISurface = {
  background: BACKGROUND,
  foreground: FOREGROUND,
}

export function herbANSIStyles(): string {
  const surface = HERB_ANSI_SURFACE

  return `
    :host {
      display: block;
      white-space: pre;
      overflow-x: auto;
      tab-size: 2;
      font-family: ${HERB_ANSI_FONT_STACK};
      font-size: 0.875rem;
      line-height: 1.5;
      ${ANSI_VARIABLE_PREFIX}dim-opacity: 0.65;
      ${ANSI_VARIABLE_PREFIX}foreground: ${surface.foreground};
      ${ANSI_VARIABLE_PREFIX}background: ${surface.background};
      color: var(${ANSI_VARIABLE_PREFIX}foreground, ${surface.foreground});
      background-color: var(${ANSI_VARIABLE_PREFIX}background, ${surface.background});
    }

    :host([hidden]) {
      display: none;
    }

    a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  `
}

interface BrowserGlobals {
  customElements?: CustomElementRegistry
  HTMLElement?: typeof HTMLElement
  MutationObserver?: typeof MutationObserver
}

const globals = globalThis as BrowserGlobals

const HTMLElementBase: typeof HTMLElement = globals.HTMLElement ?? (class {} as unknown as typeof HTMLElement)

export class HerbANSIElement extends HTMLElementBase {
  static readonly tagName = HERB_ANSI_TAG_NAME

  private output: HTMLElement
  private observer: MutationObserver | null = null
  private converter = new ANSIConverter()
  private resolver: LinkResolver | null = null

  static define(tagName: string = HerbANSIElement.tagName): boolean {
    if (globals.customElements === undefined || globals.HTMLElement === undefined) return false
    if (globals.customElements.get(tagName) !== undefined) return true

    globals.customElements.define(tagName, HerbANSIElement)

    return true
  }

  constructor() {
    super()

    const root = this.attachShadow({ mode: "open" })

    const style = document.createElement("style")
    style.textContent = herbANSIStyles()

    this.output = document.createElement("div")

    root.append(style, this.output)
  }

  connectedCallback(): void {
    this.render()

    if (globals.MutationObserver === undefined) return

    this.observer = new globals.MutationObserver(() => this.render())
    this.observer.observe(this, { childList: true, characterData: true, subtree: true })
  }

  disconnectedCallback(): void {
    this.observer?.disconnect()
    this.observer = null
  }

  get linkResolver(): LinkResolver | null {
    return this.resolver
  }

  set linkResolver(resolver: LinkResolver | null) {
    this.resolver = resolver
    this.converter = new ANSIConverter(resolver === null ? {} : { linkResolver: resolver })

    this.render()
  }

  render(): void {
    this.output.innerHTML = this.converter.toHTML(this.textContent ?? "")
  }
}
