import dedent from "dedent"
import { describe, test } from "vitest"

import { HerbScopedStyleNoUnusedSelectorRule } from "../../src/rules/herb-scoped-style-no-unused-selector.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HerbScopedStyleNoUnusedSelectorRule)

describe("herb-scoped-style-no-unused-selector", () => {
  test("passes when the selector's class is used in the file", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .card { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes when the selector's id is used in the file", () => {
    expectNoOffenses(dedent`
      <style scoped>
        #hero { color: red; }
      </style>

      <section id="hero">Hi</section>
    `)
  })

  test("passes when the class appears among several on an element", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .active { color: red; }
      </style>

      <div class="card active large">Hi</div>
    `)
  })

  test("passes with no scoped block", () => {
    expectNoOffenses(dedent`
      <style>
        .typo { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes for a tag selector that matches an element", () => {
    expectNoOffenses(dedent`
      <style scoped>
        a { color: red; }
      </style>

      <a href="/">Hi</a>
    `)
  })

  test("flags a tag selector when no element has that tag", () => {
    expectError("The `a` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        a { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes for a descendant selector that matches the structure", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .card span { color: red; }
      </style>

      <div class="card"><span>Hi</span></div>
    `)
  })

  test("flags a descendant selector when nothing matches the structure", () => {
    expectError("The `.card span` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .card span { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes for a child selector that matches the structure", () => {
    expectNoOffenses(dedent`
      <style scoped>
        div > a { color: red; }
      </style>

      <div><a href="/">Hi</a></div>
    `)
  })

  test("flags a child selector when the element is not a direct child", () => {
    expectError("The `div > a` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        div > a { color: red; }
      </style>

      <div><p><a href="/">Hi</a></p></div>
    `)
  })

  test("does not evaluate sibling combinators", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .a + .b { color: red; }
      </style>

      <div class="a">Hi</div>
    `)
  })

  test("passes for a class only excluded by :not()", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .card:not(.active) { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags an unused selector even when the file renders a partial", () => {
    expectError("The `.typo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .typo { color: red; }
      </style>

      <div class="card"><%= render "shared/thing" %></div>
    `)
  })

  test("flags an unused selector even when the file yields", () => {
    expectError("The `.typo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .typo { color: red; }
      </style>

      <div class="card"><%= yield %></div>
    `)
  })

  test("passes when a class is set on an Action View helper", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .typo { color: red; }
      </style>

      <%= content_tag(:div, "Hi", class: "typo") %>
    `)
  })

  test("flags an unused selector when the file emits raw HTML", () => {
    expectError("The `.typo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .typo { color: red; }
      </style>

      <div class="card"><%= raw "<span class='typo'></span>" %></div>
    `)
  })

  test("flags an unused selector when the file marks output html_safe", () => {
    expectError("The `.typo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .typo { color: red; }
      </style>

      <div class="card"><%= widget.html_safe %></div>
    `)
  })

  test("flags an unused selector even when a class is built from an expression", () => {
    expectError("The `.typo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .typo { color: red; }
      </style>

      <div class="card <%= state %>">Hi</div>
    `)
  })

  test("passes when the CSS is not parseable", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .card { color: red;
      </style>

      <div class="foo">Hi</div>
    `)
  })

  test("flags a class selector that matches nothing", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags an id selector that matches nothing", () => {
    expectError("The `#hreo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        #hreo { color: red; }
      </style>

      <section id="hero">Hi</section>
    `)
  })

  test("flags when the required class is absent even with :not()", () => {
    expectError("The `.crad:not(.active)` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .crad:not(.active) { color: red; }
      </style>

      <div class="card active">Hi</div>
    `)
  })

  test("flags each unused selector in the block", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])
    expectError("The `.titel` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [4, 2])

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
        .card { color: blue; }
        .titel { color: green; }
      </style>

      <div class="card"><span class="title">Hi</span></div>
    `)
  })

  test("points at the individual selector inside a list", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 6])

    assertOffenses(dedent`
      <style scoped>
        .a, .crad { color: red; }
      </style>

      <div class="a">Hi</div>
    `)
  })

  test("passes for a token-list attribute selector whose class exists", () => {
    expectNoOffenses(dedent`
      <style scoped>
        [class~="card"] { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags a data attribute selector when no element has that attribute", () => {
    expectError("The `[data-state=\"open\"]` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        [data-state="open"] { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes for an attribute-presence selector whose attribute is used", () => {
    expectNoOffenses(dedent`
      <style scoped>
        [data-controller] { color: red; }
      </style>

      <div data-controller="chat">Hi</div>
    `)
  })

  test("flags an attribute-presence selector whose attribute is absent", () => {
    expectError("The `[data-controller]` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        [data-controller] { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes for a substring attribute selector", () => {
    expectNoOffenses(dedent`
      <style scoped>
        [class^="ca"] { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags a token-list attribute selector whose class matches nothing", () => {
    expectError("The `[class~=\"crad\"]` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        [class~="crad"] { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes when the scoped style body contains ERB", () => {
    expectNoOffenses(dedent`
      <style scoped>
        <% if dark %>.crad { color: white; }<% end %>
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags an unused selector even when an unrelated `.render` method is called", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
      </style>

      <div class="card"><%= post.render %></div>
    `)
  })

  test("does not flag a class supplied to an Action View helper", () => {
    expectNoOffenses(dedent`
      <style scoped>
        .button { color: red; }
      </style>

      <%= link_to "Home", root_path, class: "button" %>
    `)
  })

  test("flags an unused class selector when only an id is dynamic", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
      </style>

      <div class="card" id="card_<%= n %>">Hi</div>
    `)
  })

  test("flags an unused id selector when only a class is dynamic", () => {
    expectError("The `#hreo` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        #hreo { color: red; }
      </style>

      <div class="card <%= state %>" id="hero">Hi</div>
    `)
  })

  test("spans the whole rule when its only selector is unused", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", { line: 2, column: 2, endLine: 2, endColumn: 23 })

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("passes for an attribute value selector that matches an element", () => {
    expectNoOffenses(dedent`
      <style scoped>
        a[target="_blank"] { display: none; }
      </style>

      <a target="_blank">Hi</a>
    `)
  })

  test("flags an attribute value selector whose value matches no element", () => {
    expectError("The `a[target=\"_self\"]` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        a[target="_self"] { display: none; }
      </style>

      <a target="_blank">Hi</a>
    `)
  })

  test("flags the whole block when every rule is unused", () => {
    expectError("Every rule in this `<style scoped>` block matches no element in this file, so the block never applies. Remove it, or point its selectors at markup the file uses.", { line: 1, column: 0, endLine: 4, endColumn: 8 })

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
        .titel { color: blue; }
      </style>

      <div class="card">Hi</div>
    `)
  })

  test("flags rules individually when only some are unused", () => {
    expectError("The `.crad` selector in this `<style scoped>` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.", [2, 2])

    assertOffenses(dedent`
      <style scoped>
        .crad { color: red; }
        .card { color: blue; }
      </style>

      <div class="card">Hi</div>
    `)
  })
})
