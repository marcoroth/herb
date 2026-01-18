import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { TailwindClassSorterRewriter } from "../../src/built-ins/tailwind-class-sorter.js"

import { createRewriterTest } from "../helpers/rewriter-test-helper.js"

const { expectTransform, expectNoTransform } = createRewriterTest(TailwindClassSorterRewriter)

describe("tailwind-class-sorter", () => {
  describe("semantics", () => {
    beforeAll(async () => {
      await Herb.load()
    })

    test("has correct name and description", () => {
      const rewriter = new TailwindClassSorterRewriter()

      expect(rewriter.name).toBe("tailwind-class-sorter")
      expect(rewriter.description).toContain("Tailwind")
      expect(rewriter.description).toContain("class")
    })

    test("initializes without error", async () => {
      const rewriter = new TailwindClassSorterRewriter()

      await expect(rewriter.initialize({ baseDir: process.cwd() })).resolves.not.toThrow()
    })

    test("returns original AST when sorter not initialized", async () => {
      const input = dedent`
        <div class="px-4 bg-blue-500"></div>
      `

      const rewriter = new TailwindClassSorterRewriter()

      const parseResult = Herb.parse(input, { track_whitespace: true })
      const document = rewriter.rewrite(parseResult.value, { baseDir: process.cwd() })

      expect(document).toBe(parseResult.value)

      const output = IdentityPrinter.print(document)
      expect(output).toBe(input)
    })

    test("returns rewritten AST for inspection", async () => {
      const document = await expectTransform(
        `<div class="px-4 bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4"></div>`
      )

      expect(document.type).toBe("AST_DOCUMENT_NODE")
    })
  })

  describe("sorting", () => {
    test("sorts simple Tailwind classes in class attribute", async () => {
      await expectTransform(
        `<div class="px-4 bg-blue-500 text-white rounded py-2"></div>`,
        `<div class="rounded bg-blue-500 px-4 py-2 text-white"></div>`,
      )
    })

    test("handles attributes with ERB content by moving ERB to end", async () => {
      await expectTransform(
        `<div class="px-4 <%= extra_classes %> bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 <%= extra_classes %>"></div>`
      )
    })

    test("handles empty class attribute", async () => {
      await expectNoTransform(`<div class=""></div>`)
    })

    test("handles elements without class attribute", async () => {
      await expectNoTransform(`<div id="test"></div>`)
    })

    test("handles multiple elements with class attributes", async () => {
      await expectTransform(
        dedent`
          <div class="px-4 bg-blue-500">
            <span class="text-white font-bold"></span>
            <p class="mt-4 mb-2"></p>
          </div>
        `,
        dedent`
          <div class="bg-blue-500 px-4">
            <span class="font-bold text-white"></span>
            <p class="mb-2 mt-4"></p>
          </div>
        `
      )
    })

    test("handles complex ERB structure", async () => {
      await expectTransform(
        dedent`
          <div class="px-4 bg-blue-500">
            <% if user.admin? %>
              <span class="text-red-500 font-bold"></span>
            <% end %>
          </div>
        `,
        dedent`
          <div class="bg-blue-500 px-4">
            <% if user.admin? %>
              <span class="font-bold text-red-500"></span>
            <% end %>
          </div>
        `
      )
    })
  })

  describe("ERB string interpolation within class names", () => {
    test("preserves interpolation in middle of class name (issue #879)", async () => {
      await expectNoTransform(
        `<div class="foo-<%= bar %>-100"></div>`
      )
    })

    test("preserves interpolation at start of class name", async () => {
      await expectNoTransform(
        `<div class="<%= prefix %>-blue-500"></div>`
      )
    })

    test("preserves interpolation at end of class name", async () => {
      await expectNoTransform(
        `<div class="bg-<%= suffix %>"></div>`
      )
    })

    test("preserves interpolation with multiple ERB tags in middle", async () => {
      await expectNoTransform(
        `<div class="foo-<%= bar %><%= baz %>-100"></div>`
      )
    })

    test("preserves multiple ERB interpolations building one class name", async () => {
      await expectNoTransform(
        `<div class="<%= prefix %>-<%= color %>-<%= shade %>"></div>`
      )
    })

    test("preserves complex interpolation with prefix, middle, and suffix", async () => {
      await expectNoTransform(
        `<div class="text-<%= color %>-<%= shade %>"></div>`
      )
    })

    test("preserves interpolation with static prefix and multiple dynamic parts", async () => {
      await expectNoTransform(
        `<div class="bg-<%= color %><%= modifier %>"></div>`
      )
    })

    test("preserves interpolation with dynamic prefix and static suffix", async () => {
      await expectNoTransform(
        `<div class="<%= utility %>-500"></div>`
      )
    })

    test("preserves fully dynamic class with hyphens", async () => {
      await expectNoTransform(
        `<div class="<%= prefix %>-<%= suffix %>"></div>`
      )
    })

    test("preserves multiple interpolated class names", async () => {
      await expectNoTransform(
        `<div class="foo-<%= bar %>-100 baz-<%= qux %>-200"></div>`
      )
    })

    test("preserves multiple different interpolation patterns in same attribute", async () => {
      await expectNoTransform(
        `<div class="<%= a %>-blue bg-<%= b %> text-<%= c %>-500"></div>`
      )
    })

    test("sorts static classes and moves multiple interpolations to end", async () => {
      await expectTransform(
        `<div class="some-<%= erb %> text-blue-300 <%= another %>-erb bg-white"></div>`,
        `<div class="bg-white text-blue-300 some-<%= erb %> <%= another %>-erb"></div>`
      )
    })

    test("sorts static classes and moves interpolation to end", async () => {
      await expectTransform(
        `<div class="px-4 foo-<%= bar %>-100 bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 foo-<%= bar %>-100"></div>`
      )
    })

    test("still sorts classes inside conditionals when interpolation is in main attribute", async () => {
      await expectTransform(
        `<div class="foo-<%= bar %>-100 <% if valid? %> text-white bg-blue-500 <% end %>"></div>`,
        `<div class="foo-<%= bar %>-100 <% if valid? %> bg-blue-500 text-white <% end %>"></div>`
      )
    })
  })

  describe("ERB nodes in class attributes", () => {
    test("moves ERB output node from middle to end", async () => {
      await expectTransform(
        `<div class="px-4 <%= extra_classes %> bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 <%= extra_classes %>"></div>`
      )
    })

    test("moves ERB output node from beginning to end", async () => {
      await expectTransform(
        `<div class="<%= extra_classes %> px-4 bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 <%= extra_classes %>"></div>`
      )
    })

    test("keeps ERB output node at end when already there", async () => {
      await expectTransform(
        `<div class="px-4 bg-blue-500 <%= extra_classes %>"></div>`,
        `<div class="bg-blue-500 px-4 <%= extra_classes %>"></div>`
      )
    })

    test("preserves order of multiple ERB output nodes at end", async () => {
      await expectTransform(
        `<div class="px-4 <%= classes_1 %> bg-blue-500 <%= classes_2 %>"></div>`,
        `<div class="bg-blue-500 px-4 <%= classes_1 %> <%= classes_2 %>"></div>`
      )
    })

    test("handles multiple ERB nodes mixed with classes", async () => {
      await expectTransform(
        `<div class="<%= base %> px-4 text-white <%= extra %> bg-blue-500 rounded <%= more %>"></div>`,
        `<div class="rounded bg-blue-500 px-4 text-white <%= base %> <%= extra %> <%= more %>"></div>`
      )
    })

    test("sorts classes and moves ERB with whitespace preservation", async () => {
      await expectTransform(
        dedent`
          <div class="px-4 <%= classes %> bg-blue-500 text-white"></div>
        `,
        dedent`
          <div class="bg-blue-500 px-4 text-white <%= classes %>"></div>
        `
      )
    })

    test("handles only ERB output nodes without static classes", async () => {
      await expectNoTransform(
        `<div class="<%= classes %>"></div>`
      )
    })

    test("handles mixed ERB expressions and output tags", async () => {
      await expectTransform(
        `<div class="px-4 <%= output %> <% expression %> bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 <%= output %> <% expression %>"></div>`
      )
    })
  })

  describe("ERB conditionals in class attributes", () => {
    test("moves ERB if/else/end block to end and sorts classes within each branch", async () => {
      await expectTransform(
        `<div class="px-4 <% if valid? %> bg-green-500 font-bold text-green-800 <% else %> font-bold bg-red-500 text-red-800 <% end %> text-white"></div>`,
        `<div class="px-4 text-white <% if valid? %> bg-green-500 font-bold text-green-800 <% else %> bg-red-500 font-bold text-red-800 <% end %>"></div>`
      )
    })

    test("moves simple if/end block to end with sorted classes inside", async () => {
      await expectTransform(
        `<div class="px-4 <% if admin? %> text-red-500 font-bold <% end %> bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 <% if admin? %> font-bold text-red-500 <% end %>"></div>`
      )
    })

    test("handles unless conditional with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% unless disabled? %> bg-green-500 text-white <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% unless disabled? %> bg-green-500 text-white <% end %>"></div>`
      )
    })

    test("handles elsif branches with sorted classes in each", async () => {
      await expectTransform(
        `<div class="px-4 <% if error? %> text-red-500 font-bold <% elsif warning? %> font-bold text-yellow-500 <% else %> text-green-500 font-bold <% end %> bg-white"></div>`,
        `<div class="bg-white px-4 <% if error? %> font-bold text-red-500 <% elsif warning? %> font-bold text-yellow-500 <% else %> font-bold text-green-500 <% end %>"></div>`
      )
    })

    test("handles multiple if blocks each moved to end with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% if valid? %> text-green-500 font-bold <% end %> bg-white <% if highlighted? %> border-blue-500 rounded <% end %> py-2"></div>`,
        `<div class="bg-white px-4 py-2 <% if valid? %> font-bold text-green-500 <% end %> <% if highlighted? %> rounded border-blue-500 <% end %>"></div>`
      )
    })

    test("preserves nested conditionals structure while sorting classes", async () => {
      await expectTransform(
        `<div class="px-4 <% if outer? %> font-bold <% if inner? %> text-green-500 <% end %> bg-white <% end %> py-2"></div>`,
        `<div class="px-4 py-2 <% if outer? %> bg-white font-bold <% if inner? %> text-green-500 <% end %> <% end %>"></div>`
      )
    })

    test("handles conditional with only ERB output nodes inside", async () => {
      await expectTransform(
        `<div class="px-4 <% if dynamic? %> <%= dynamic_classes %> <% end %> bg-blue-500"></div>`,
        `<div class="bg-blue-500 px-4 <% if dynamic? %> <%= dynamic_classes %> <% end %>"></div>`
      )
    })

    test("mixes static classes, ERB outputs, and conditionals", async () => {
      await expectTransform(
        `<div class="<%= base_classes %> px-4 <% if valid? %> text-green-500 font-bold <% end %> bg-white <%= extra_classes %>"></div>`,
        `<div class="bg-white px-4 <%= base_classes %> <% if valid? %> font-bold text-green-500 <% end %> <%= extra_classes %>"></div>`
      )
    })

    test("sorts multiline conditional branches", async () => {
      await expectTransform(
        dedent`
          <div class="px-4
            <% if valid? %>
              bg-green-500 font-bold text-green-800
            <% else %>
              font-bold bg-red-500 text-red-800
            <% end %>
            rounded">
          </div>
        `,
        `<div class="rounded px-4 <% if valid? %> bg-green-500 font-bold text-green-800 <% else %> bg-red-500 font-bold text-red-800 <% end %>">\n</div>`
      )
    })

    test("handles nested if/else with static content and ERB output tags", async () => {
      await expectTransform(
        `<div class="px-4 <% if outer? %> bg-blue-500 <%= dynamic_if %> text-white <% else %> <%= dynamic_else %> bg-red-500 font-bold <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% if outer? %> bg-blue-500 text-white <%= dynamic_if %> <% else %> bg-red-500 font-bold <%= dynamic_else %> <% end %>"></div>`
      )
    })
  })

  describe("ERB loops and blocks", () => {
    test("handles ERB block (each) with sorted classes inside", async () => {
      await expectTransform(
        `<div class="px-4 <% @items.each do |item| %> <%= item.class %> text-white bg-blue-500 <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% @items.each do |item| %> bg-blue-500 text-white <%= item.class %> <% end %>"></div>`
      )
    })

    test("handles ERB for loop with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% for item in @items %> text-white bg-blue-500 <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% for item in @items %> bg-blue-500 text-white <% end %>"></div>`
      )
    })

    test("handles ERB while loop with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% while condition? %> text-white bg-blue-500 <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% while condition? %> bg-blue-500 text-white <% end %>"></div>`
      )
    })

    test("handles ERB until loop with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% until finished? %> text-white bg-blue-500 <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% until finished? %> bg-blue-500 text-white <% end %>"></div>`
      )
    })
  })

  describe("ERB case/when statements", () => {
    test("handles ERB case with when branches and sorted classes in each", async () => {
      await expectTransform(
        `<div class="px-4 <% case status %> <% when :active %> text-green-500 font-bold <% when :inactive %> font-bold text-gray-500 <% end %> bg-white"></div>`,
        `<div class="bg-white px-4 <% case status %> <% when :active %> text-green-500 font-bold <% when :inactive %> font-bold text-gray-500 <% end %>"></div>`
      )
    })

    test("handles ERB case with else clause", async () => {
      await expectTransform(
        `<div class="px-4 <% case status %> <% when :active %> text-green-500 font-bold <% else %> font-bold text-red-500 <% end %> bg-white"></div>`,
        `<div class="bg-white px-4 <% case status %> <% when :active %> text-green-500 font-bold <% else %> font-bold text-red-500 <% end %>"></div>`
      )
    })
  })

  describe("ERB yield", () => {
    test("handles ERB yield tag by moving it to end", async () => {
      await expectTransform(
        `<div class="px-4 <%= yield %> bg-blue-500 text-white"></div>`,
        `<div class="bg-blue-500 px-4 text-white <%= yield %>"></div>`
      )
    })

    test("handles ERB yield with argument", async () => {
      await expectTransform(
        `<div class="px-4 bg-blue-500 <%= yield :sidebar %> text-white"></div>`,
        `<div class="bg-blue-500 px-4 text-white <%= yield :sidebar %>"></div>`
      )
    })
  })

  describe("ERB exception handling", () => {
    test("handles ERB begin/rescue/end with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% begin %> text-white bg-blue-500 <% rescue %> font-bold bg-red-500 <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% begin %> bg-blue-500 text-white <% rescue %> bg-red-500 font-bold <% end %>"></div>`
      )
    })

    test("handles ERB begin/rescue/else/ensure with sorted classes in each", async () => {
      await expectTransform(
        `<div class="px-4 <% begin %> text-white bg-blue-500 <% rescue %> font-bold bg-red-500 <% else %> bg-green-500 text-green-800 <% ensure %> text-gray-500 font-bold <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% begin %> bg-blue-500 text-white <% rescue %> bg-red-500 font-bold <% else %> bg-green-500 text-green-800 <% ensure %> font-bold text-gray-500 <% end %>"></div>`
      )
    })

    test("handles multiple rescue clauses with sorted classes", async () => {
      await expectTransform(
        `<div class="px-4 <% begin %> text-white bg-blue-500 <% rescue Error1 %> font-bold bg-red-500 <% rescue Error2 %> bg-yellow-500 font-bold <% end %> rounded"></div>`,
        `<div class="rounded px-4 <% begin %> bg-blue-500 text-white <% rescue Error1 %> bg-red-500 font-bold <% rescue Error2 %> bg-yellow-500 font-bold <% end %>"></div>`
      )
    })
  })

  describe("ERB case/in statements (pattern matching)", () => {
    test("handles ERB case/in with in branches and sorted classes in each", async () => {
      await expectTransform(
        `<div class="px-4 <% case user %> <% in { role: :admin } %> text-red-500 font-bold <% in { role: :user } %> font-bold text-blue-500 <% end %> bg-white"></div>`,
        `<div class="bg-white px-4 <% case user %> <% in { role: :admin } %> text-red-500 font-bold <% in { role: :user } %> font-bold text-blue-500 <% end %>"></div>`
      )
    })

    test("handles ERB case/in with else clause", async () => {
      await expectTransform(
        `<div class="px-4 <% case user %> <% in { role: :admin } %> text-red-500 font-bold <% else %> font-bold text-gray-500 <% end %> bg-white"></div>`,
        `<div class="bg-white px-4 <% case user %> <% in { role: :admin } %> text-red-500 font-bold <% else %> font-bold text-gray-500 <% end %>"></div>`
      )
    })
  })

  describe("whitespace variations", () => {
    test("handles classes separated by newlines", async () => {
      await expectTransform(
        dedent`
          <div class="px-4
                      bg-blue-500
                      text-white
                      rounded"></div>
        `,
        dedent`
          <div class="rounded bg-blue-500 px-4 text-white"></div>
        `
      )
    })

    test("handles classes with tabs", async () => {
      await expectTransform(
        `<div class="px-4	bg-blue-500	text-white"></div>`,
        `<div class="bg-blue-500 px-4 text-white"></div>`
      )
    })

    test("handles classes with multiple consecutive spaces", async () => {
      await expectTransform(
        `<div class="px-4    bg-blue-500   text-white"></div>`,
        `<div class="bg-blue-500 px-4 text-white"></div>`
      )
    })
  })

  describe("consecutive ERB tags", () => {
    test("adds spacing between moved consecutive ERB tags", async () => {
      await expectTransform(
        `<div class="px-4 bg-blue-500<%= foo %><%= bar %>"></div>`,
        `<div class="bg-blue-500 px-4 <%= foo %> <%= bar %>"></div>`
      )
    })
  })

  describe("modern Tailwind features", () => {
    test("handles arbitrary values with brackets", async () => {
      await expectTransform(
        `<div class="px-4 bg-blue-500 w-[100px] text-white"></div>`,
        `<div class="w-[100px] bg-blue-500 px-4 text-white"></div>`
      )
    })

    test("handles important modifier", async () => {
      await expectTransform(
        `<div class="px-4 !bg-blue-500 text-white"></div>`,
        `<div class="!bg-blue-500 px-4 text-white"></div>`
      )
    })

    test("handles negative values", async () => {
      await expectTransform(
        `<div class="px-4 bg-blue-500 -mt-4 text-white"></div>`,
        `<div class="-mt-4 bg-blue-500 px-4 text-white"></div>`
      )
    })
  })

  describe("edge cases", () => {
    test("handles very long class lists", async () => {
      const classes = Array.from({ length: 50 }, (_, i) => `class-${i}`).join(' ')
      const longInput = `<div class="${classes} px-4 bg-blue-500"></div>`
      const longOutput = `<div class="${classes} bg-blue-500 px-4"></div>`
      const result = await expectTransform(longInput, longOutput)
      expect(result).toBeDefined()
    })

    test("handles class attribute with only whitespace", async () => {
      await expectNoTransform(`<div class="   "></div>`)
    })
  })
})
