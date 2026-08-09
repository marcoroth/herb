import { describe, test, expect } from "vitest"

import { themes } from "../src/themes.js"
import { generateStylesheet } from "../src/stylesheet.js"

describe("Stylesheet", () => {
  test("generates custom properties for a single theme", () => {
    const css = generateStylesheet(themes.onedark, "onedark")

    expect(css).toMatchSnapshot()
  })

  test("generates a dark light pair", () => {
    const css = generateStylesheet(themes.onedark, "onedark:github-light", {
      scheme: themes["github-light"],
      label: "github-light",
    })

    expect(css).toMatchSnapshot()
  })

  test("maps named colors to hex", () => {
    const css = generateStylesheet(themes.simple, "simple")

    expect(css).toMatchSnapshot()
  })
})
