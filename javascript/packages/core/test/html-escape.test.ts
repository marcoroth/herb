import { describe, test, expect } from "vitest"

import { escapeHTML, HTML_ESCAPES } from "../src/html-escape.js"

describe("escapeHTML", () => {
  test("escapes every HTML significant character", () => {
    expect(escapeHTML(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;")
  })

  test("leaves text without those characters alone", () => {
    expect(escapeHTML("plain text")).toBe("plain text")
  })

  test("escapes an ampersand once, so an entity it wrote is not escaped again", () => {
    expect(escapeHTML("a & b")).toBe("a &amp; b")
    expect(escapeHTML("&amp;")).toBe("&amp;amp;")
  })

  test("writes the same entities the server writes", () => {
    expect(HTML_ESCAPES).toEqual({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })
  })
})
