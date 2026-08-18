import { describe, it, expect } from "vitest"

import { HERB_ANSI_SURFACE, HERB_ANSI_TAG_NAME, HerbANSIElement, herbANSIStyles } from "../src/ansi-element.js"

describe("HERB_ANSI_TAG_NAME", () => {
  it("is a valid custom element name", () => {
    expect(HERB_ANSI_TAG_NAME).toBe("herb-ansi")
    expect(HERB_ANSI_TAG_NAME).toContain("-")
  })
})

describe("HERB_ANSI_SURFACE", () => {
  it("paints the background Herb's default output is read on", () => {
    expect(HERB_ANSI_SURFACE.background).toBe("#282C34")
  })

  it("never pairs a foreground with an equal background", () => {
    expect(HERB_ANSI_SURFACE.foreground).not.toBe(HERB_ANSI_SURFACE.background)
  })
})

describe("HerbANSIElement without a DOM", () => {
  it("can be imported, so the pure conversion stays usable in Node", () => {
    expect(HerbANSIElement).toBeTypeOf("function")
    expect(HerbANSIElement.tagName).toBe(HERB_ANSI_TAG_NAME)
  })

  it("reports that it did not register", () => {
    expect(HerbANSIElement.define()).toBe(false)
  })

  it("stays safe when called twice", () => {
    expect(HerbANSIElement.define()).toBe(false)
    expect(HerbANSIElement.define()).toBe(false)
  })
})

describe("herbANSIStyles", () => {
  const styles = herbANSIStyles()

  it("preserves whitespace", () => {
    expect(styles).toContain("white-space: pre;")
  })

  it("uses a monospace stack so the gutter lines up", () => {
    expect(styles).toContain("font-family: ui-monospace,")
    expect(styles).toContain("monospace;")
  })

  it("sets both a foreground and a background on the host", () => {
    expect(styles).toContain("color: var(--herb-ansi-foreground,")
    expect(styles).toContain("background-color: var(--herb-ansi-background,")
  })

  it("carries the surface as the literal fallback for both", () => {
    expect(styles).toContain(`color: var(--herb-ansi-foreground, ${HERB_ANSI_SURFACE.foreground});`)
    expect(styles).toContain(`background-color: var(--herb-ansi-background, ${HERB_ANSI_SURFACE.background});`)
  })

  it("resolves every color it paints through a custom property, so a page can retheme it", () => {
    const declarations = (styles.match(/(?:color|background-color):.*?;/g) ?? []).filter(
      declaration => !declaration.includes("inherit"),
    )

    expect(declarations.length).toBeGreaterThan(0)

    for (const declaration of declarations) {
      expect(declaration).toContain("var(--herb-ansi-")
    }
  })

  it("declares the opacity that dim runs resolve through", () => {
    expect(styles).toContain("--herb-ansi-dim-opacity: 0.65;")
  })

  it("does not uppercase any text", () => {
    expect(styles).not.toContain("text-transform")
  })
})
