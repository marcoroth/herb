import { describe, it, expect } from "vitest"

import { writeFileSync, mkdtempSync, readFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

import { loadCustomTheme, themes, THEME_NAMES } from "../src/themes.js"

describe("loadCustomTheme", () => {
  it("accepts a theme written before BACKGROUND, FOREGROUND and ANSI_PALETTE existed", () => {
    const onedark = JSON.parse(readFileSync(new URL("../themes/onedark.json", import.meta.url), "utf-8"))

    delete onedark.BACKGROUND
    delete onedark.FOREGROUND
    delete onedark.ANSI_PALETTE

    const path = join(mkdtempSync(join(tmpdir(), "herb-theme-")), "custom.json")
    writeFileSync(path, JSON.stringify(onedark))

    expect(() => loadCustomTheme(path)).not.toThrow()
    expect(loadCustomTheme(path).TOKEN_IDENTIFIER).toBe(themes.onedark.TOKEN_IDENTIFIER)
  })
})

describe("ANSI_PALETTE", () => {
  const SLOTS = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "bright-black",
    "bright-red",
    "bright-green",
    "bright-yellow",
    "bright-blue",
    "bright-magenta",
    "bright-cyan",
    "bright-white",
  ]

  for (const name of THEME_NAMES) {
    it(`gives ${name} all sixteen slots, in order`, () => {
      const palette = themes[name].ANSI_PALETTE

      expect(palette, name).toBeDefined()
      expect(Object.keys(palette!)).toEqual(SLOTS)

      for (const [slot, hex] of Object.entries(palette!)) {
        expect(hex, `${name} ${slot}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
    })
  }

  it("gives every theme its own palette rather than a shared one", () => {
    const serialized = THEME_NAMES.map(name => JSON.stringify(themes[name].ANSI_PALETTE))

    expect(new Set(serialized).size).toBe(THEME_NAMES.length)
  })
})
