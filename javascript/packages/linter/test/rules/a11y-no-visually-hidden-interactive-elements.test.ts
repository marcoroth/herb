import dedent from "dedent"
import { describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../../src/linter.js"
import { A11yNoVisuallyHiddenInteractiveElementsRule } from "../../src/rules/a11y-no-visually-hidden-interactive-elements.js"

import { createLinterTest } from "../helpers/linter-test-helper.js"
import { renderedFrom, renderedFromNowhere } from "../helpers/partial-caller-context.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoVisuallyHiddenInteractiveElementsRule)

const message = (tagName: string) => `The keyboard-focusable \`<${tagName}>\` element uses \`sr-only\` without a focus reveal class, so sighted keyboard users may think focus was lost. Remove \`sr-only\` or add a class such as \`focus:not-sr-only\` to reveal the element when it receives focus.`

describe("a11y-no-visually-hidden-interactive-elements", () => {
  test("passes for non-interactive element with sr-only", () => {
    expectNoOffenses('<h2 class="sr-only">Account settings</h2>')
  })

  test("passes for non-interactive element with sr-only class among others", () => {
    expectNoOffenses('<span class="sr-only text-bold">Visually hidden text</span>')
  })

  test("passes for interactive element without sr-only", () => {
    expectNoOffenses('<button class="btn">Submit</button>')
  })

  test("passes for interactive element without class attribute", () => {
    expectNoOffenses("<button>Submit</button>")
  })

  test("passes for div with sr-only", () => {
    expectNoOffenses('<div class="sr-only">Hidden content</div>')
  })

  test("passes for p with sr-only", () => {
    expectNoOffenses('<p class="sr-only">Hidden text</p>')
  })

  test("fails for button with sr-only", () => {
    expectWarning(message("button"))

    assertOffenses('<button class="sr-only">Submit</button>')
  })

  test("fails for a with sr-only", () => {
    expectWarning(message("a"))

    assertOffenses('<a class="sr-only" href="/about">About</a>')
  })

  test("passes for a without href with sr-only", () => {
    expectNoOffenses('<a class="sr-only">Placeholder</a>')
  })

  test("fails for a without href made keyboard-focusable by tabindex", () => {
    expectWarning(message("a"))

    assertOffenses('<a class="sr-only" tabindex="0">Custom link</a>')
  })

  test("passes for a link removed from keyboard navigation", () => {
    expectNoOffenses('<a class="sr-only" href="/about" tabindex="-1">About</a>')
  })

  test("fails for summary with sr-only", () => {
    expectWarning(message("summary"))

    assertOffenses('<summary class="sr-only">Details</summary>')
  })

  test("fails for select with sr-only", () => {
    expectWarning(message("select"))

    assertOffenses('<select class="sr-only"><option>A</option></select>')
  })

  test("passes for option with sr-only because options are not independently keyboard-focusable", () => {
    expectNoOffenses('<option class="sr-only">A</option>')
  })

  test("fails for textarea with sr-only", () => {
    expectWarning(message("textarea"))

    assertOffenses('<textarea class="sr-only"></textarea>')
  })

  test("fails for button with sr-only among other classes", () => {
    expectWarning(message("button"))

    assertOffenses('<button class="btn sr-only primary">Submit</button>')
  })

  test("passes for button with sr-only and focus:not-sr-only", () => {
    expectNoOffenses('<button class="sr-only focus:not-sr-only">Skip to content</button>')
  })

  test("passes for a disabled button with sr-only", () => {
    expectNoOffenses('<button class="sr-only" disabled>Unavailable</button>')
  })

  test("passes for a disabled select with sr-only", () => {
    expectNoOffenses('<select class="sr-only" disabled><option>A</option></select>')
  })

  test("passes for a disabled textarea with sr-only", () => {
    expectNoOffenses('<textarea class="sr-only" disabled></textarea>')
  })

  test("fails for an aria-disabled button because it remains keyboard-focusable", () => {
    expectWarning(message("button"))

    assertOffenses('<button class="sr-only" aria-disabled="true">Unavailable</button>')
  })

  test("fails for a custom keyboard-focusable element with sr-only", () => {
    expectWarning(message("div"))

    assertOffenses('<div class="sr-only" tabindex="0">Custom control</div>')
  })

  test("passes for an element removed from keyboard navigation with sr-only", () => {
    expectNoOffenses('<button class="sr-only" tabindex="-1">Programmatically focusable</button>')
  })

  test("passes for a with sr-only and focus-within:not-sr-only", () => {
    expectNoOffenses('<a class="sr-only focus-within:not-sr-only" href="#main">Skip to content</a>')
  })

  test("passes with focus-visible:not-sr-only", () => {
    expectNoOffenses('<button class="sr-only focus-visible:not-sr-only">Submit</button>')
  })

  test("passes with group-focus-within:not-sr-only", () => {
    expectNoOffenses('<button class="sr-only group-focus-within:not-sr-only">Submit</button>')
  })

  test("passes with a responsive focus reveal class", () => {
    expectNoOffenses('<button class="sr-only md:focus:not-sr-only">Submit</button>')
  })

  test("passes with nested responsive and state prefixes", () => {
    expectNoOffenses('<button class="sr-only dark:lg:focus-visible:not-sr-only">Submit</button>')
  })

  test("fails with active:not-sr-only because the element stays hidden on focus", () => {
    expectWarning(message("button"))

    assertOffenses('<button class="sr-only active:not-sr-only">Submit</button>')
  })

  test("fails with hover:not-sr-only because hover does not reveal keyboard focus", () => {
    expectWarning(message("button"))

    assertOffenses('<button class="sr-only hover:not-sr-only">Submit</button>')
  })

  test("matches exact class tokens only", () => {
    expectNoOffenses('<button class="sr-only-label not-sr-only-ish">Submit</button>')
  })

  test("recognizes sr-only separated by tabs and newlines", () => {
    expectWarning(message("button"))

    assertOffenses('<button class="btn\n\tsr-only\tprimary">Submit</button>')
  })

  test("treats class names as case-sensitive", () => {
    expectNoOffenses('<button class="SR-ONLY">Submit</button>')
  })

  test("does not flag input elements", () => {
    expectNoOffenses('<input class="sr-only" type="file" />')
  })

  test("does not flag text, checkbox, or radio inputs", () => {
    expectNoOffenses(dedent`
      <input class="sr-only" type="text">
      <input class="sr-only" type="checkbox">
      <input class="sr-only" type="radio">
    `)
  })

  test("does not flag an input with tabindex", () => {
    expectNoOffenses('<input class="sr-only" tabindex="0">')
  })

  test("does not flag an input with a dynamic type", () => {
    expectNoOffenses('<input class="sr-only" type="<%= input_type %>">')
  })

  test("skips mixed ERB class attributes", () => {
    expectNoOffenses('<button class="sr-only <%= additional_classes %>">Submit</button>')
  })

  describe("across call sites", () => {
    const partial = "app/views/shared/_hidden_control.html.erb"

    const config = Config.fromObject({
      linter: {
        rules: {
          "a11y-no-visually-hidden-interactive-elements": { enabled: true },
        },
      },
    })

    function offensesFor(context: ReturnType<typeof renderedFrom>, source = '<button class="sr-only">Submit</button>') {
      const linter = new Linter(
        Herb,
        [A11yNoVisuallyHiddenInteractiveElementsRule],
        config,
      )

      return linter.lint(source, context).offenses
    }

    test("attaches the call chain to an offense in a rendered partial", () => {
      const [offense] = offensesFor(
        renderedFrom(partial, ["html", "body", "main"]),
      )

      expect(offense.renderedFrom?.frames).toHaveLength(1)
      expect(offense.renderedFrom?.frames[0].ancestors).toEqual([
        "html",
        "body",
        "main",
      ])
      expect(offense.message).toBe(message("button"))
    })

    test("attaches one resolved chain when the partial has multiple call sites", () => {
      const [offense] = offensesFor(
        renderedFrom(
          partial,
          ["html", "body", "main"],
          ["html", "body", "aside"],
        ),
      )

      expect(offense.renderedFrom?.frames).toHaveLength(1)
      expect(offense.renderedFrom?.frames[0].ancestors).toEqual([
        "html",
        "body",
        "main",
      ])
      expect(offense.message).toBe(message("button"))
    })

    test("omits the call chain when nothing renders the file", () => {
      const [offense] = offensesFor(renderedFromNowhere(partial))

      expect(offense.renderedFrom).toBeUndefined()
    })

    test("omits the external call chain for a whole document", () => {
      const [offense] = offensesFor(
        renderedFrom(partial, ["html", "body", "main"]),
        '<html><body><button class="sr-only">Submit</button></body></html>',
      )

      expect(offense.renderedFrom).toBeUndefined()
    })

    test("omits the surrounding call chain inside content_for", () => {
      const [offense] = offensesFor(
        renderedFrom(partial, ["html", "body", "main"]),
        '<%= content_for :actions do %><button class="sr-only">Submit</button><% end %>',
      )

      expect(offense.renderedFrom).toBeUndefined()
    })

    test("attaches the call chain to every offense in the partial", () => {
      const offenses = offensesFor(
        renderedFrom(partial, ["html", "body", "main"]),
        '<button class="sr-only">Save</button><a class="sr-only" href="/cancel">Cancel</a>',
      )

      expect(offenses).toHaveLength(2)
      expect(offenses.every((offense) => offense.renderedFrom?.frames.length === 1)).toBe(true)
    })
  })
})
