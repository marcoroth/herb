import { beforeAll, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { UJSNoRemoteAttributeRule } from "../../src/rules/ujs-no-remote-attribute.js"
import { Linter } from "../../src/linter.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(UJSNoRemoteAttributeRule)

const ATTRIBUTE_MESSAGE = "`data-remote` is a deprecated `@rails/ujs` attribute. Turbo handles links and form submissions by default, so remove it once the app has migrated from `@rails/ujs` to Turbo."
const OPTION_MESSAGE = "This option renders `data-remote`, a deprecated `@rails/ujs` attribute. Turbo handles links and form submissions by default, so remove it once the app has migrated from `@rails/ujs` to Turbo."

describe("ujs-no-remote-attribute", () => {
  describe("HTML attributes", () => {
    test("passes when the attribute is absent", () => {
      expectNoOffenses(`<a href="/posts">Load posts</a>`)
    })

    test("passes for a near-miss attribute name", () => {
      expectNoOffenses(`<a href="/posts" data-remotes="true">Load posts</a>`)
    })

    test("passes for the attributes owned by the sibling rules", () => {
      expectNoOffenses(`<a href="/posts/1" data-method="delete" data-confirm="Sure?" data-disable-with="Saving...">Delete</a>`)
    })

    test("fails for `data-remote`", () => {
      expectWarning(ATTRIBUTE_MESSAGE, { line: 1, column: 17 })

      assertOffenses(`<a href="/posts" data-remote="true">Load posts</a>`)
    })

    test("fails for a value-less attribute", () => {
      expectWarning(ATTRIBUTE_MESSAGE)

      assertOffenses(`<a href="/posts" data-remote>Load posts</a>`)
    })
  })

  describe("Action View helpers", () => {
    test("passes without the option", () => {
      expectNoOffenses(`<%= link_to "Load posts", posts_path %>`)
    })

    test("fails for the `remote:` option on `link_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to "Load posts", posts_path, remote: true %>`)
    })

    test("fails for the `data: { remote: ... }` option on `link_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= link_to "Load posts", posts_path, data: { remote: true } %>`)
    })

    test("fails for the `remote:` option on `form_with`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= form_with model: @post, remote: true do |f| %><% end %>`)
    })

    test("fails for the `remote:` option on `mail_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= mail_to "a@b.com", "Mail", remote: true %>`)
    })

    // Unlike `method:`, `remote:` applied to real forms too, so the helper set here
    // is derived from every Action View helper rendering an `<a>` or a `<form>`.
    test("fails for the `remote:` option on `button_to`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= button_to "Delete", post_path(@post), remote: true %>`)
    })

    test("fails for the `remote:` option on `form_tag`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= form_tag "/posts", remote: true do %><% end %>`)
    })

    test("fails for `data: { remote: ... }` on `tag.a`", () => {
      expectWarning(OPTION_MESSAGE)

      assertOffenses(`<%= tag.a "Load posts", href: posts_path, data: { remote: true } %>`)
    })

    test("passes for a `remote:` keyword on a non-helper call", () => {
      expectNoOffenses(`<%= presenter.build(remote: true) %>`)
    })

    test("passes for a `data:` hash nested in another option", () => {
      expectNoOffenses(`<%= render "form", locals: { data: { remote: true } } %>`)
    })
  })

  describe("with the raw linter", () => {
    beforeAll(async () => {
      await Herb.load()
    })

    test("tags offenses as deprecated", () => {
      const linter = new Linter(Herb, [UJSNoRemoteAttributeRule])
      const result = linter.lint(`<a href="/posts" data-remote="true">Load posts</a>`)

      expect(result.offenses).toHaveLength(1)
      expect(result.offenses[0].tags).toEqual(["deprecated"])
      expect(result.offenses[0].severity).toBe("warning")
    })

    test("reports the option only once", () => {
      const linter = new Linter(Herb, [UJSNoRemoteAttributeRule])
      const result = linter.lint(`<%= link_to "Load posts", posts_path, remote: true %>`)

      expect(result.offenses).toHaveLength(1)
    })
  })
})
