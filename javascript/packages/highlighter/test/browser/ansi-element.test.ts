import { describe, it, expect, beforeAll, afterEach } from "vitest"

import { ANSI_ESCAPE } from "../../src/ansi.js"
import { ANSI_PALETTE } from "../../src/ansi-html.js"
import { HERB_ANSI_SURFACE, HerbANSIElement } from "../../src/ansi-element.js"

import linterOutput from "../fixtures/terminal-linter.txt?raw"

const CSI_REGEX = new RegExp(`${ANSI_ESCAPE}\\[[0-9;?]*[a-zA-Z]`, "g")
const OSC_REGEX = new RegExp(`${ANSI_ESCAPE}\\]\\d*;[^\\x07${ANSI_ESCAPE}]*(?:${ANSI_ESCAPE}\\\\|\\x07)`, "g")

const channels = (hex: string): number[] => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
const rgb = (hex: string): string => `rgb(${channels(hex).join(", ")})`
const inlineRGB = (hex: string): string => `rgb(${channels(hex).join(",")})`

const mount = (text: string, attributes: Record<string, string> = {}): HerbANSIElement => {
  const element = document.createElement(HerbANSIElement.tagName) as HerbANSIElement

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }

  element.textContent = text
  document.body.append(element)

  return element
}

const shadowOf = (element: HerbANSIElement): HTMLElement => {
  const output = element.shadowRoot?.querySelector("div")

  if (output === null || output === undefined) throw new Error("element has no shadow output")

  return output as HTMLElement
}

describe("HerbANSIElement in a browser", () => {
  beforeAll(() => {
    expect(HerbANSIElement.define()).toBe(true)
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it("registers under its tag name", () => {
    expect(customElements.get(HerbANSIElement.tagName)).toBe(HerbANSIElement)
  })

  it("stays registered when define is called again", () => {
    expect(HerbANSIElement.define()).toBe(true)
    expect(customElements.get(HerbANSIElement.tagName)).toBe(HerbANSIElement)
  })

  it("upgrades an element parsed from markup", async () => {
    document.body.innerHTML = `<herb-ansi>\x1b[31mred\x1b[0m</herb-ansi>`

    const element = document.querySelector(HerbANSIElement.tagName) as HerbANSIElement

    await customElements.whenDefined(HerbANSIElement.tagName)

    expect(element).toBeInstanceOf(HerbANSIElement)
    expect(shadowOf(element).innerHTML).toBe(`<span style="color:${inlineRGB(ANSI_PALETTE.red)}">red</span>`)
  })

  it("keeps the raw output as textContent so it survives without the script", () => {
    const element = mount("\x1b[31mred\x1b[0m")

    expect(element.textContent).toBe("\x1b[31mred\x1b[0m")
  })

  describe("the surface", () => {
    it("paints a foreground that differs from its background", () => {
      const styles = getComputedStyle(mount("plain"))

      expect(styles.color).not.toBe(styles.backgroundColor)
    })

    it("paints the declared surface", () => {
      const styles = getComputedStyle(mount("plain"))

      expect(styles.backgroundColor).toBe(rgb(HERB_ANSI_SURFACE.background))
      expect(styles.color).toBe(rgb(HERB_ANSI_SURFACE.foreground))
    })

    it("preserves whitespace and uses a monospace stack", () => {
      const styles = getComputedStyle(mount("  two  spaces"))

      expect(styles.whiteSpace).toBe("pre")
      expect(styles.fontFamily).toContain("ui-monospace")
    })
  })

  describe("colors resolved through the cascade", () => {
    it("resolves a base color through Herb's palette", () => {
      const element = mount("\x1b[91mbright red\x1b[0m")
      const span = shadowOf(element).querySelector("span") as HTMLElement

      expect(getComputedStyle(span).color).toBe(rgb(ANSI_PALETTE["bright-red"]))
    })

    it("renders a truecolor run with the color from the sequence", () => {
      const element = mount("\x1b[38;2;224;108;117mtoken\x1b[0m")
      const span = shadowOf(element).querySelector("span") as HTMLElement

      expect(getComputedStyle(span).color).toBe("rgb(224, 108, 117)")
    })

    it("renders a diff background tint", () => {
      const element = mount("\x1b[48;2;58;34;36mremoved\x1b[0m")
      const span = shadowOf(element).querySelector("span") as HTMLElement

      expect(getComputedStyle(span).backgroundColor).toBe("rgb(58, 34, 36)")
    })

    it("dims a faint run without changing its color", () => {
      const element = mount("\x1b[2mdim\x1b[0m")
      const span = shadowOf(element).querySelector("span") as HTMLElement

      expect(Number(getComputedStyle(span).opacity)).toBeLessThan(1)
    })

    it("lets a page repaint the surface, because an outer rule beats :host", () => {
      const style = document.createElement("style")
      style.textContent = `herb-ansi { --herb-ansi-background: #ffffff; --herb-ansi-foreground: #24292e; }`
      document.head.append(style)

      const styles = getComputedStyle(mount("plain"))

      expect(styles.backgroundColor).toBe("rgb(255, 255, 255)")
      expect(styles.color).toBe("rgb(36, 41, 46)")

      style.remove()
    })
  })

  describe("real captured CLI output", () => {
    it("keeps every visible character of the captured linter output", () => {
      const element = mount(linterOutput)
      const stripped = linterOutput.replace(OSC_REGEX, "").replace(CSI_REGEX, "")

      expect(shadowOf(element).textContent).toBe(stripped)
    })
  })

  describe("hyperlinks", () => {
    it("renders an OSC 8 link as a safe anchor", () => {
      const element = mount(`\x1b]8;;https://herb-tools.dev\x1b\\docs\x1b]8;;\x1b\\`)
      const anchor = shadowOf(element).querySelector("a") as HTMLAnchorElement

      expect(anchor.href).toBe("https://herb-tools.dev/")
      expect(anchor.rel).toBe("noopener noreferrer")
    })

    it("does not create an anchor for a javascript: target", () => {
      const element = mount(`\x1b]8;;javascript:alert(1)\x1b\\click\x1b]8;;\x1b\\`)
      const output = shadowOf(element)

      expect(output.querySelector("a")).toBe(null)
      expect(output.textContent).toBe("click")
    })
  })

  describe("reacting to content", () => {
    it("re-renders when the text changes", async () => {
      const element = mount("\x1b[31mfirst\x1b[0m")

      expect(shadowOf(element).textContent).toBe("first")

      element.textContent = "\x1b[32msecond\x1b[0m"

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(shadowOf(element).textContent).toBe("second")
      expect(shadowOf(element).innerHTML).toBe(`<span style="color:${inlineRGB(ANSI_PALETTE.green)}">second</span>`)
    })

    it("stops observing once disconnected", async () => {
      const element = mount("before")

      element.remove()
      element.textContent = "after"

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(shadowOf(element).textContent).toBe("before")
    })
  })
})
