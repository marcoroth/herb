import { readFileSync } from "fs"

import { describe, it, expect } from "vitest"

import { colors, colorize, hyperlink } from "../src/color.js"
import { linePrefix } from "../src/gutter.js"
import { ANSI_PALETTE, ANSIConverter } from "../src/ansi-html.js"

import type { ANSIColorName } from "../src/ansi-html.js"

const converter = new ANSIConverter()

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8")

const rgbOf = (hex: string): string => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",")})`

const spanCount = (html: string): number => (html.match(/<span/g) ?? []).length

const DIM = `opacity:var(--herb-ansi-dim-opacity, 0.65)`


describe("ANSIConverter", () => {
  describe("plain text", () => {
    it("returns text without markup when there are no escape sequences", () => {
      expect(converter.toHTML("hello world")).toBe("hello world")
    })

    it("returns an empty string for empty input", () => {
      expect(converter.toHTML("")).toBe("")
    })

    it("preserves newlines and leading whitespace", () => {
      expect(converter.toHTML("  a\n  b\n")).toBe("  a\n  b\n")
    })

    it("passes box-drawing and arrow characters through untouched", () => {
      expect(converter.toHTML("│ → ~ └─")).toBe("│ → ~ └─")
    })
  })

  describe("escaping", () => {
    it("escapes angle brackets, ampersands and quotes", () => {
      expect(converter.toHTML(`<div class="a" id='b'>&</div>`)).toBe(
        "&lt;div class=&quot;a&quot; id=&#x27;b&#x27;&gt;&amp;&lt;/div&gt;",
      )
    })

    it("escapes text inside a styled span", () => {
      expect(converter.toHTML("\x1b[31m<%= a && b %>\x1b[0m")).toBe(
        `<span style="color:rgb(224,108,117)">&lt;%= a &amp;&amp; b %&gt;</span>`,
      )
    })

    it("escapes an ampersand in a hyperlink target", () => {
      expect(converter.toHTML(hyperlink("docs", "https://herb-tools.dev/?a=1&b=2"))).toContain(
        `href="https://herb-tools.dev/?a=1&amp;b=2"`,
      )
    })

    it("escapes a closing tag in the text before any markup is added", () => {
      expect(converter.toHTML("\x1b[1m</span>\x1b[0m")).toBe(`<span style="font-weight:700">&lt;/span&gt;</span>`)
    })
  })

  describe("attributes", () => {
    it("renders bold", () => {
      expect(converter.toHTML("\x1b[1mbold\x1b[0m")).toBe(`<span style="font-weight:700">bold</span>`)
    })

    it("renders dim through the opacity property so a page can tune it", () => {
      expect(converter.toHTML("\x1b[2mdim\x1b[0m")).toBe(`<span style="${DIM}">dim</span>`)
    })

    it("renders italic", () => {
      expect(converter.toHTML("\x1b[3mitalic\x1b[0m")).toBe(`<span style="font-style:italic">italic</span>`)
    })

    it("renders underline", () => {
      expect(converter.toHTML("\x1b[4munderline\x1b[0m")).toBe(
        `<span style="text-decoration:underline">underline</span>`,
      )
    })

    it("turns bold and dim off with 22", () => {
      expect(converter.toHTML("\x1b[1ma\x1b[22mb")).toBe(`<span style="font-weight:700">a</span>b`)
      expect(converter.toHTML("\x1b[2ma\x1b[22mb")).toBe(`<span style="${DIM}">a</span>b`)
    })
  })

  describe("base colors", () => {
    it("maps 30 through 37 onto the palette", () => {
      Object.keys(ANSI_PALETTE).slice(0, 8).forEach((name, index) => {
        expect(converter.toHTML(`\x1b[${30 + index}mx\x1b[0m`), name).toBe(
          `<span style="color:${rgbOf(ANSI_PALETTE[name as ANSIColorName])}">x</span>`,
        )
      })
    })

    it("maps 90 through 97 onto the bright palette", () => {
      expect(converter.toHTML("\x1b[90mx\x1b[0m")).toBe(`<span style="color:rgb(92,99,112)">x</span>`)
      expect(converter.toHTML("\x1b[91mx\x1b[0m")).toBe(`<span style="color:rgb(224,108,117)">x</span>`)
      expect(converter.toHTML("\x1b[97mx\x1b[0m")).toBe(`<span style="color:rgb(255,255,255)">x</span>`)
    })

    it("maps 40 through 47 onto backgrounds", () => {
      expect(converter.toHTML("\x1b[41mx\x1b[0m")).toBe(`<span style="background-color:rgb(224,108,117)">x</span>`)
    })

    it("maps 100 through 107 onto bright backgrounds", () => {
      expect(converter.toHTML("\x1b[100mx\x1b[0m")).toBe(`<span style="background-color:rgb(92,99,112)">x</span>`)
    })

    it("resolves the colors that color.ts emits through Herb's palette", () => {
      expect(converter.toHTML(`${colors.cyan}info${colors.reset}`)).toBe(
        `<span style="color:${rgbOf(ANSI_PALETTE.cyan)}">info</span>`,
      )
    })

    it("routes the first sixteen 256-color entries through the palette", () => {
      expect(converter.toHTML("\x1b[38;5;1mx\x1b[0m")).toBe(`<span style="color:rgb(224,108,117)">x</span>`)
      expect(converter.toHTML("\x1b[38;5;9mx\x1b[0m")).toBe(`<span style="color:rgb(224,108,117)">x</span>`)
    })
  })

  describe("truecolor", () => {
    it("renders a 38;2 foreground", () => {
      expect(converter.toHTML("\x1b[38;2;224;108;117mx\x1b[0m")).toBe(
        `<span style="color:rgb(224,108,117)">x</span>`,
      )
    })

    it("renders a 48;2 background", () => {
      expect(converter.toHTML("\x1b[48;2;58;34;36mx\x1b[0m")).toBe(
        `<span style="background-color:rgb(58,34,36)">x</span>`,
      )
    })

    it("renders a foreground and background together", () => {
      expect(converter.toHTML("\x1b[38;2;255;255;255m\x1b[48;2;0;0;0mx\x1b[0m")).toBe(
        `<span style="color:rgb(255,255,255);background-color:rgb(0,0,0)">x</span>`,
      )
    })

    it("matches the sequence that colorize emits for a hex color", () => {
      expect(converter.toHTML(colorize("x", "#e06c75"))).toBe(`<span style="color:rgb(224,108,117)">x</span>`)
    })
  })

  describe("combined sequences", () => {
    it("applies every code in a 2;91 sequence", () => {
      expect(converter.toHTML("\x1b[2;91mx\x1b[0m")).toBe(
        `<span style="${DIM};color:${rgbOf(ANSI_PALETTE["bright-red"])}">x</span>`,
      )
    })

    it("applies every code in a 2;1 sequence", () => {
      expect(converter.toHTML("\x1b[2;1mx\x1b[0m")).toBe(`<span style="font-weight:700;${DIM}">x</span>`)
    })

    it("applies dim together with a truecolor foreground in one sequence", () => {
      expect(converter.toHTML("\x1b[2;38;2;224;108;117mx\x1b[0m")).toBe(
        `<span style="${DIM};color:rgb(224,108,117)">x</span>`,
      )
    })

    it("applies a reset that leads a combined sequence", () => {
      expect(converter.toHTML("\x1b[1ma\x1b[0;31mb\x1b[0m")).toBe(
        `<span style="font-weight:700">a</span><span style="color:rgb(224,108,117)">b</span>`,
      )
    })

    it("treats an empty parameter list as a reset", () => {
      expect(converter.toHTML("\x1b[1ma\x1b[mb")).toBe(`<span style="font-weight:700">a</span>b`)
    })

    it("drops non-SGR control sequences", () => {
      expect(converter.toHTML("a\x1b[2Kb\x1b[1;1Hc")).toBe("abc")
    })

    it("leaves an unterminated sequence out of the output", () => {
      expect(converter.toHTML("abc\x1b[31")).toBe("abc")
      expect(converter.toHTML("abc\x1b")).toBe("abc")
    })
  })

  describe("the palette", () => {
    it("comes from the theme file rather than a literal in here", () => {
      const theme = JSON.parse(readFileSync(new URL("../themes/onedark.json", import.meta.url), "utf-8"))

      expect(ANSI_PALETTE).toEqual(theme.ANSI_PALETTE)
    })

    it("has exactly the sixteen entries the override indexes into", () => {
      expect(Object.keys(ANSI_PALETTE).length).toBe(16)

      for (const hex of Object.values(ANSI_PALETTE)) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
      }
    })

    it("maps the slots in order, independent of the palette's own keys", () => {
      expect(converter.toHTML("\x1b[30mx\x1b[0m")).toBe(`<span style="color:rgb(44,49,58)">x</span>`)
      expect(converter.toHTML("\x1b[37mx\x1b[0m")).toBe(`<span style="color:rgb(171,178,191)">x</span>`)
      expect(converter.toHTML("\x1b[90mx\x1b[0m")).toBe(`<span style="color:rgb(92,99,112)">x</span>`)
      expect(converter.toHTML("\x1b[97mx\x1b[0m")).toBe(`<span style="color:rgb(255,255,255)">x</span>`)
    })
  })

  describe("reuse", () => {
    it("does not bleed an unterminated color into the next conversion", () => {
      const shared = new ANSIConverter()

      expect(shared.toHTML("\x1b[31mred")).toBe(`<span style="color:${rgbOf(ANSI_PALETTE.red)}">red</span>`)
      expect(shared.toHTML("plain")).toBe("plain")
    })

    it("does not bleed an open hyperlink into the next conversion", () => {
      const shared = new ANSIConverter()

      shared.toHTML(`\x1b]8;;https://herb-tools.dev\x1b\\dangling`)

      expect(shared.toHTML("plain")).toBe("plain")
    })
  })

  describe("state across newlines", () => {
    it("carries a color across a line boundary", () => {
      expect(converter.toHTML("\x1b[31mone\ntwo\x1b[0m")).toBe(`<span style="color:rgb(224,108,117)">one\ntwo</span>`)
    })

    it("does not reset styling at the start of a line", () => {
      const html = converter.toHTML("\x1b[2mfirst\nsecond\nthird")

      expect(spanCount(html)).toBe(1)
      expect(html).toBe(`<span style="${DIM}">first\nsecond\nthird</span>`)
    })

    it("carries an open hyperlink across a newline", () => {
      expect(converter.toHTML(`\x1b]8;;https://herb-tools.dev\x1b\\one\ntwo\x1b]8;;\x1b\\`)).toBe(
        `<a href="https://herb-tools.dev" rel="noopener noreferrer">one\ntwo</a>`,
      )
    })
  })

  describe("run collapsing", () => {
    it("merges neighbouring runs that share styling", () => {
      const html = converter.toHTML("\x1b[31ma\x1b[31mb\x1b[31mc\x1b[0m")

      expect(spanCount(html)).toBe(1)
      expect(html).toBe(`<span style="color:rgb(224,108,117)">abc</span>`)
    })

    it("merges runs separated by a no-op sequence", () => {
      const html = converter.toHTML("\x1b[2m<\x1b[22m\x1b[2mul\x1b[22m\x1b[2m>\x1b[22m")

      expect(spanCount(html)).toBe(1)
      expect(html).toBe(`<span style="${DIM}">&lt;ul&gt;</span>`)
    })

    it("keeps one span per run when styling actually differs", () => {
      expect(spanCount(converter.toHTML("\x1b[31ma\x1b[32mb\x1b[31mc\x1b[0m"))).toBe(3)
    })

    it("does not merge runs that differ only in the link target", () => {
      expect(converter.toHTML(`${hyperlink("a", "https://a.example")}${hyperlink("b", "https://b.example")}`)).toBe(
        [
          `<a href="https://a.example" rel="noopener noreferrer">a</a>`,
          `<a href="https://b.example" rel="noopener noreferrer">b</a>`,
        ].join(""),
      )
    })

    it("does not merge runs that are separated by unstyled text", () => {
      const html = converter.toHTML("\x1b[31ma\x1b[0mgap\x1b[31mb\x1b[0m")

      expect(spanCount(html)).toBe(2)
      expect(html).toContain(">gap<")
    })

    it("emits nothing for a sequence with no text", () => {
      expect(converter.toHTML("\x1b[31m\x1b[0m")).toBe("")
    })
  })

  describe("OSC 8 hyperlinks", () => {
    it("renders a hyperlink as an anchor", () => {
      expect(converter.toHTML(hyperlink("rule", "https://herb-tools.dev/linter/rules/erb-no-empty-tags"))).toBe(
        `<a href="https://herb-tools.dev/linter/rules/erb-no-empty-tags" rel="noopener noreferrer">rule</a>`,
      )
    })

    it("renders a linked gutter line number as an anchor", () => {
      const html = converter.toHTML(linePrefix(12, true, "brightRed", "file:///app/views/page.html.erb"))

      expect(html).toContain(
        `<a href="file:///app/views/page.html.erb" rel="noopener noreferrer"><span style="font-weight:700"> 12</span></a>`,
      )
    })

    it("rewrites the target through a link resolver", () => {
      const resolver = new ANSIConverter({
        linkResolver: url => url.replace("file:///workspace/", "https://github.com/marcoroth/herb/blob/main/"),
      })

      expect(resolver.toHTML(hyperlink("page.html.erb", "file:///workspace/app/views/page.html.erb"))).toBe(
        `<a href="https://github.com/marcoroth/herb/blob/main/app/views/page.html.erb" rel="noopener noreferrer">page.html.erb</a>`,
      )
    })

    it("passes the original target to the link resolver", () => {
      const targets: string[] = []
      const resolver = new ANSIConverter({ linkResolver: url => { targets.push(url); return url } })

      resolver.toHTML(`${hyperlink("file", "file:///app/page.html.erb")}${hyperlink("rule", "https://herb-tools.dev")}`)

      expect(targets).toEqual(["file:///app/page.html.erb", "https://herb-tools.dev"])
    })

    it("drops the link when the resolver returns null", () => {
      const resolver = new ANSIConverter({ linkResolver: () => null })

      expect(resolver.toHTML(hyperlink("page.html.erb", "file:///app/views/page.html.erb"))).toBe("page.html.erb")
    })

    it("still rejects an unsafe target returned by the resolver", () => {
      const resolver = new ANSIConverter({ linkResolver: () => "javascript:alert(1)" })

      expect(resolver.toHTML(hyperlink("page.html.erb", "file:///app/views/page.html.erb"))).toBe("page.html.erb")
    })

    it("ignores the resolver when links are disabled", () => {
      const resolver = new ANSIConverter({ links: false, linkResolver: () => "https://herb-tools.dev" })

      expect(resolver.toHTML(hyperlink("page.html.erb", "file:///app/views/page.html.erb"))).toBe("page.html.erb")
    })

    it("accepts a BEL terminator as well as ST", () => {
      expect(converter.toHTML("\x1b]8;;https://herb-tools.dev\x07link\x1b]8;;\x07")).toBe(
        `<a href="https://herb-tools.dev" rel="noopener noreferrer">link</a>`,
      )
    })

    it("wraps styled runs that sit inside the link", () => {
      const html = converter.toHTML(
        `\x1b]8;;file:///app/views/page.html.erb\x1b\\\x1b[36mpage.html.erb\x1b[0m:\x1b[36m8:34\x1b[0m\x1b]8;;\x1b\\`,
      )

      expect(html).toBe(
        [
          `<a href="file:///app/views/page.html.erb" rel="noopener noreferrer">`,
          `<span style="color:rgb(86,182,194)">page.html.erb</span>`,
          `:`,
          `<span style="color:rgb(86,182,194)">8:34</span>`,
          `</a>`,
        ].join(""),
      )
    })

    it("allows http, https and file targets", () => {
      expect(converter.toHTML(hyperlink("a", "http://example.com"))).toContain("<a href=")
      expect(converter.toHTML(hyperlink("a", "https://example.com"))).toContain("<a href=")
      expect(converter.toHTML(hyperlink("a", "file:///tmp/a.erb"))).toContain("<a href=")
    })

    it("accepts an uppercased scheme", () => {
      expect(converter.toHTML(hyperlink("a", "HTTPS://example.com"))).toContain("<a href=")
    })

    it("renders a javascript: target as plain text and keeps the text", () => {
      const html = converter.toHTML(hyperlink("click me", "javascript:alert(1)"))

      expect(html).toBe("click me")
      expect(html).not.toContain("<a")
      expect(html).not.toContain("javascript:")
    })

    it("renders a data: target as plain text", () => {
      expect(converter.toHTML(hyperlink("x", "data:text/html,<script>"))).toBe("x")
    })

    it("rejects any other scheme, and targets with no scheme at all", () => {
      for (const target of ["vscode://file/a", "/a/b", ":no-scheme", "//evil.example"]) {
        expect(converter.toHTML(hyperlink("x", target)), target).toBe("x")
      }
    })

    it("escapes a target that tries to break out of the attribute", () => {
      const html = converter.toHTML(hyperlink("x", `https://a.example/?q="><script>&`))

      expect(html).toBe(
        `<a href="https://a.example/?q=&quot;&gt;&lt;script&gt;&amp;" rel="noopener noreferrer">x</a>`,
      )
    })

    it("keeps styling when the target is rejected", () => {
      expect(converter.toHTML(`\x1b]8;;javascript:alert(1)\x1b\\\x1b[1mx\x1b[0m\x1b]8;;\x1b\\`)).toBe(
        `<span style="font-weight:700">x</span>`,
      )
    })

    it("closes the link on an empty target", () => {
      expect(converter.toHTML(`${hyperlink("a", "https://example.com")}tail`)).toBe(
        `<a href="https://example.com" rel="noopener noreferrer">a</a>tail`,
      )
    })

    it("renders anchors as plain text when links are disabled", () => {
      expect(new ANSIConverter({ links: false }).toHTML(hyperlink("a", "https://example.com"))).toBe("a")
    })

    it("drops OSC sequences other than 8 without leaking their payload", () => {
      expect(converter.toHTML("\x1b]0;window title\x07body")).toBe("body")
    })

    it("does not let an OSC 0 sequence split an open link", () => {
      expect(converter.toHTML(`\x1b]8;;https://a.dev\x1b\\one\x1b]0;title\x07two\x1b]8;;\x1b\\`)).toBe(
        `<a href="https://a.dev" rel="noopener noreferrer">onetwo</a>`,
      )
    })
  })

  describe("real captured CLI output", () => {
    it("renders a focus listing with the gutter and line numbers", () => {
      const html = converter.toHTML(fixture("terminal-focus.txt"))

      expect(html).toContain("│")
      expect(html).toContain(`color:${rgbOf(ANSI_PALETTE["bright-black"])}`)
      expect(html).toContain(DIM)
      expect(html).toContain("sample.html.erb")
      expect(html).not.toContain("\x1b")
      expect(html).toMatchSnapshot()
    })

    it("renders a diagnostics run with markers and the severity label", () => {
      const html = converter.toHTML(fixture("terminal-diagnostics.txt"))

      expect(html).toContain("→")
      expect(html).toContain("~")
      expect(html).toContain(
        `<span style="font-weight:700;color:${rgbOf(ANSI_PALETTE["bright-red"])}">error</span>`,
      )
      expect(html).toContain(`color:${rgbOf(ANSI_PALETTE["bright-yellow"])}`)
      expect(html).not.toContain("\x1b")
      expect(html).toMatchSnapshot()
    })

    it("renders a diff with added and removed backgrounds", () => {
      const html = converter.toHTML(fixture("terminal-diff.txt"))

      expect(html).toContain("background-color:rgb(58,34,36)")
      expect(html).toContain("background-color:rgb(107,46,49)")
      expect(html).toContain("background-color:rgb(30,50,38)")
      expect(html).toContain("background-color:rgb(46,94,61)")
      expect(html).not.toContain("\x1b")
      expect(html).toMatchSnapshot()
    })

    it("renders linter output with hyperlinks for the rule and the file", () => {
      const source = fixture("terminal-linter.txt")
      const html = converter.toHTML(source)

      expect(source).toContain("\x1b]8;;")
      expect(html).not.toContain("\x1b")
      expect(html).not.toContain("]8;;")

      expect(html).toContain(`<a href="https://herb-tools.dev/linter/rules/actionview-no-implicit-polymorphic-url" rel="noopener noreferrer">`)
      expect(html).toContain(`<a href="file:///workspace/app/views/offenses.html.erb" rel="noopener noreferrer">`)
      expect(html).toMatchSnapshot()
    })

    it("collapses the captured output well below one span per character", () => {
      const source = fixture("terminal-linter.txt")

      expect(spanCount(converter.toHTML(source))).toBeLessThan(source.length / 10)
    })
  })
})
