import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLAttributeNameValidCharactersRule } from "../../src"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLAttributeNameValidCharactersRule)

describe("html-attribute-name-valid-characters", () => {
  test("passes for names made of letters, digits, and hyphens", () => {
    expectNoOffenses(dedent`
      <div class="a" data-user-id="1" aria-label="Close" h1-title></div>
      <input type="checkbox" checked>
      <custom-element some-attribute="x"></custom-element>
    `)
  })

  test("passes for uppercase letters", () => {
    expectNoOffenses('<div CLASS="a" Data-Value="1"></div>')
  })

  test("passes for a single namespace colon", () => {
    expectNoOffenses(dedent`
      <svg xmlns:xlink="http://www.w3.org/1999/xlink">
        <use xlink:href="#icon"></use>
      </svg>
      <p xml:lang="en">Text</p>
    `)
  })

  test("leaves underscores to html-no-underscores-in-attribute-names", () => {
    expectNoOffenses('<div data_user_id="1" _target="blank"></div>')
  })

  test("passes for dynamic names made of valid literal parts", () => {
    expectNoOffenses(dedent`
      <div data-<%= key %>="value"></div>
      <div <%= dynamic_name %>="value"></div>
      <div data-<%= key %>-test="value"></div>
    `)
  })

  test("fails for curly braces", () => {
    expectWarning("Attribute name `{{element_hidden}}` contains `{` and `}`, which are not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div {{element_hidden}}></div>')
  })

  test("fails for brackets and parentheses", () => {
    expectWarning("Attribute name `[value]` contains `[` and `]`, which are not valid in an HTML attribute name. Use letters, digits, and hyphens.")
    expectWarning("Attribute name `(click)` contains `(` and `)`, which are not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div [value]="x" (click)="y"></div>')
  })

  test("fails for a stray comma between attributes", () => {
    expectWarning("Attribute name `,` contains `,`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div class="a" , id="b"></div>')
  })

  test("fails for framework shorthand prefixes", () => {
    expectWarning("Attribute name `:class` contains `:`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")
    expectWarning("Attribute name `@click` contains `@`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")
    expectWarning("Attribute name `#ref` contains `#`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")
    expectWarning("Attribute name `*ngIf` contains `*`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div :class="a" @click="b" #ref *ngIf="c"></div>')
  })

  test("fails for dots and a second colon", () => {
    expectWarning("Attribute name `x-on:keydown.enter.prevent` contains `.`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")
    expectWarning("Attribute name `hx-on::after-request` contains `:`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div x-on:keydown.enter.prevent="a" hx-on::after-request="b"></div>')
  })

  test("fails for a leading or trailing colon", () => {
    expectWarning("Attribute name `foo:` contains `:`, which is not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div foo:="a"></div>')
  })

  test("fails for names that do not start with a letter", () => {
    expectWarning("Attribute name `-foo` must start with a letter.")
    expectWarning("Attribute name `1st` must start with a letter.")

    assertOffenses('<div -foo 1st="x"></div>')
  })

  test("fails for invalid characters in the literal parts of a dynamic name", () => {
    expectWarning("Attribute name `{{<%= key %>}}` contains `{` and `}`, which are not valid in an HTML attribute name. Use letters, digits, and hyphens.")

    assertOffenses('<div {{<%= key %>}}="value"></div>')
  })

  test("reports the name location", () => {
    expectWarning("Attribute name `{{x}}` contains `{` and `}`, which are not valid in an HTML attribute name. Use letters, digits, and hyphens.", [2, 2])

    assertOffenses(dedent`
      <div
        {{x}}
        class="a"></div>
    `)
  })
})
