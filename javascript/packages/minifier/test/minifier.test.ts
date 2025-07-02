import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Minifier, MinifyingPrinter } from "../src/index.js"

describe("@herb-tools/minifier", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("Minifier", () => {
    test("is defined", () => {
      expect(Minifier).toBeDefined()
    })

    test("can be instantiated", () => {
      const minifier = new Minifier()
      expect(minifier).toBeInstanceOf(Minifier)
    })

    test("can be instantiated with options", () => {
      const minifier = new Minifier({ collapseWhitespace: false })
      expect(minifier).toBeInstanceOf(Minifier)
    })
  })

  describe("Basic minification", () => {
    test("collapses multiple spaces", () => {
      const input = '<div>Hello     World</div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div>Hello World</div>')
      expect(result.originalSize).toBe(26)
      expect(result.minifiedSize).toBe(22)
      expect(result.reduction).toBe(4)
    })

    test("collapses multiple newlines", () => {
      const input = '<div>\n\n\nHello\n\n\nWorld\n\n\n</div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div> Hello World </div>')
    })

    test("preserves single spaces", () => {
      const input = '<div>Hello World</div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div>Hello World</div>')
    })

    test("trims empty text nodes", () => {
      const input = '<div>   </div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div></div>')
    })
  })

  describe("Options", () => {
    test("preserveLineBreaks option", () => {
      const input = '<div>\n  Hello\n  World\n</div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier({ preserveLineBreaks: true })
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div>\n Hello\n World\n</div>')
    })

    test("collapseWhitespace: false", () => {
      const input = '<div>  Hello  \n  World  </div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier({ collapseWhitespace: false })
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div> Hello \n World </div>')
    })

    test("collapseMultipleSpaces: false", () => {
      const input = '<div>Hello    World</div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier({ collapseMultipleSpaces: false })
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div>Hello World</div>')
    })

    test("trimTextNodes: false", () => {
      const input = '<div>   </div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier({ trimTextNodes: false })
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div> </div>')
    })
  })

  describe("Preserve tags", () => {
    test("preserves whitespace in <pre> tags", () => {
      const input = '<pre>  Hello\n\n  World  </pre>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<pre>  Hello\n\n  World  </pre>')
    })

    test("preserves whitespace in <code> tags", () => {
      const input = '<code>  const x   =   5;  </code>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<code>  const x   =   5;  </code>')
    })

    test("preserves whitespace in <script> tags", () => {
      const input = '<script>\n  const x = 5;\n  console.log(x);\n</script>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<script>\n  const x = 5;\n  console.log(x);\n</script>')
    })

    test("preserves whitespace in nested preserve tags", () => {
      const input = '<div>  Hello  <pre>  World  </pre>  Test  </div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div> Hello <pre>  World  </pre> Test </div>')
    })

    test("custom preserve tags", () => {
      const input = '<custom>  Hello\n\n  World  </custom>'
      const minifier = new Minifier({ preserveTags: ['custom'] })
      const result = minifier.minify(input)

      expect(result.output).toBe('<custom>  Hello\n\n  World  </custom>')
    })
  })

  describe("ERB content", () => {
    test("minifies around ERB tags", () => {
      const input = '<div>  <%= @name %>  </div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div> <%= @name %> </div>')
    })

    test("minifies complex ERB templates", () => {
      const input = `<div>
        <% if @user %>
          Hello   <%= @user.name %>
        <% else %>
          Please   log   in
        <% end %>
      </div>`

      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toContain('<% if @user %>')
      expect(result.output).toContain('Hello <%= @user.name %>')
      expect(result.output).toContain('Please log in')
      expect(result.output).not.toContain('   ')
    })
  })

  describe("Edge cases", () => {
    test("handles empty input", () => {
      const minifier = new Minifier()
      const result = minifier.minify('')

      expect(result.output).toBe('')
      expect(result.originalSize).toBe(0)
      expect(result.minifiedSize).toBe(0)
    })

    test("handles input with only whitespace", () => {
      const input = '   \n\n   \t\t   '
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe(' ')
    })

    test("handles nested elements", () => {
      const input = `<div>
        <span>  Hello  </span>
        <p>
          World
        </p>
      </div>`

      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.output).toBe('<div> <span> Hello </span> <p> World </p> </div>')
    })
  })

  describe("Statistics", () => {
    test("calculates reduction correctly", () => {
      const input = '<div>    Hello    World    </div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.originalSize).toBe(33)
      expect(result.minifiedSize).toBeLessThan(result.originalSize)
      expect(result.reduction).toBe(result.originalSize - result.minifiedSize)
      expect(result.reductionPercentage).toBeGreaterThan(0)
      expect(result.reductionPercentage).toBeLessThan(100)
    })

    test("handles no reduction", () => {
      const input = '<div>Hello</div>'
      const parseResult = Herb.parse(input)
      const minifier = new Minifier()
      const result = minifier.minify(parseResult)

      expect(result.reduction).toBe(0)
      expect(result.reductionPercentage).toBe(0)
    })
  })

  describe("MinifyingPrinter", () => {
    test("is defined", () => {
      expect(MinifyingPrinter).toBeDefined()
    })

    test("can be instantiated", () => {
      const printer = new MinifyingPrinter()
      expect(printer).toBeInstanceOf(MinifyingPrinter)
    })

    test("collapses multiple spaces", () => {
      const input = '<div>Hello     World</div>'
      const parseResult = Herb.parse(input)
      const printer = new MinifyingPrinter()
      const result = printer.print(parseResult.value!)

      expect(result).toBe('<div>Hello World</div>')
    })

    test("preserves whitespace in <pre> tags", () => {
      const input = '<pre>  Hello\n\n  World  </pre>'
      const parseResult = Herb.parse(input)
      const printer = new MinifyingPrinter()
      const result = printer.print(parseResult.value!)

      expect(result).toBe('<pre>  Hello\n\n  World  </pre>')
    })

    test("handles ERB content", () => {
      const input = '<div>  <%= @name %>  </div>'
      const parseResult = Herb.parse(input)
      const printer = new MinifyingPrinter()
      const result = printer.print(parseResult.value!)

      expect(result).toBe('<div><%= @name %></div>')
    })

    test("custom preserve tags", () => {
      const input = '<custom>  Hello\n\n  World  </custom>'
      const parseResult = Herb.parse(input)
      const printer = new MinifyingPrinter({
        preserveWhitespace: ['custom']
      })
      const result = printer.print(parseResult.value!)

      expect(result).toBe('<custom>  Hello\n\n  World  </custom>')
    })
  })
})
