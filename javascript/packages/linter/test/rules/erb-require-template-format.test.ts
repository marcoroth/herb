import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBRequireTemplateFormatRule } from "../../src/rules/erb-require-template-format.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBRequireTemplateFormatRule)

describe("erb-require-template-format", () => {
  test("passes for an html template", () => {
    expectNoOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.html.erb" })
  })

  test("passes for an html partial", () => {
    expectNoOffenses("<h1>Card</h1>", { fileName: "app/views/cards/_card.html.erb" })
  })

  test("passes for an html herb template", () => {
    expectNoOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.html.herb" })
  })

  test("passes for a herb template without a format, since `.herb` implies HTML", () => {
    expectNoOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.herb" })
    expectNoOffenses("<h1>Card</h1>", { fileName: "app/views/cards/_card.herb" })
  })

  test("passes for other formats", () => {
    expectNoOffenses("<turbo-stream></turbo-stream>", { fileName: "app/views/pages/home.turbo_stream.erb" })
    expectNoOffenses("Hello", { fileName: "app/views/user_mailer/welcome.text.erb" })
    expectNoOffenses("<rss></rss>", { fileName: "app/views/posts/index.rss.erb" })
    expectNoOffenses("console.log(1)", { fileName: "app/views/posts/index.js.erb" })
    expectNoOffenses("# Hello", { fileName: "app/views/user_mailer/welcome.md.erb" })
    expectNoOffenses("{}", { fileName: "app/views/posts/index.jsonapi.erb" })
  })

  test("passes for templates of other file types", () => {
    expectNoOffenses("class <%= class_name %>; end", { fileName: "lib/generators/model/templates/model.rb.erb" })
    expectNoOffenses("worker_processes 2", { fileName: "config/deploy/shared/puma.rb.erb" })
    expectNoOffenses("server {}", { fileName: "config/nginx.conf.erb" })
  })

  test("passes for a template with a format and a variant", () => {
    expectNoOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.html+phone.erb" })
  })

  test("passes for a template with a locale and a format", () => {
    expectNoOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.de.html.erb" })
  })

  test("passes for files that are not ERB or Herb templates", () => {
    expectNoOffenses("<h1>Home</h1>", { fileName: "public/index.html" })
    expectNoOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.rhtml" })
  })

  test("passes for a dotfile template", () => {
    expectNoOffenses("SECRET=<%= secret %>", { fileName: ".env.erb" })
  })

  test("passes without a file name", () => {
    expectNoOffenses("<h1>Home</h1>")
  })

  test("fails for a template without a format", () => {
    expectError("Template `home.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `home.html.erb`, or name the format it renders.", { line: 1, column: 0 })

    assertOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home.erb" })
  })

  test("fails for a partial without a format", () => {
    expectError("Template `_card.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `_card.html.erb`, or name the format it renders.")

    assertOffenses("<h1>Card</h1>", { fileName: "app/views/cards/_card.erb" })
  })

  test("fails for a template with a variant but no format", () => {
    expectError("Template `home+phone.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `home.html+phone.erb`, or name the format it renders.")

    assertOffenses("<h1>Home</h1>", { fileName: "app/views/pages/home+phone.erb" })
  })

  test("fails for a template outside of a Rails view directory", () => {
    expectError("Template `index.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `index.html.erb`, or name the format it renders.")

    assertOffenses("<h1>Home</h1>", { fileName: "views/index.erb" })
  })

  test("fails regardless of the configured framework", () => {
    expectError("Template `index.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `index.html.erb`, or name the format it renders.")

    assertOffenses("<h1>Home</h1>", { fileName: "views/index.erb", framework: "ruby" })
  })

  test("handles Windows paths", () => {
    expectError("Template `home.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `home.html.erb`, or name the format it renders.")

    assertOffenses("<h1>Home</h1>", { fileName: "app\\views\\pages\\home.erb" })
  })

  test("reports once for a template with several lines", () => {
    expectError("Template `show.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `show.html.erb`, or name the format it renders.", { line: 1, column: 0 })

    assertOffenses(dedent`
      <% if @user.admin? %>
        <span>Admin</span>
      <% end %>
    `, { fileName: "app/views/users/show.erb" })
  })

  test("reports for an empty template", () => {
    expectError("Template `empty.erb` has no format in its file name, so Herb and the framework rendering it cannot tell what it outputs. Rename it to `empty.html.erb`, or name the format it renders.")

    assertOffenses("", { fileName: "app/views/pages/empty.erb" })
  })

  test("does not report while the template does not parse", () => {
    expectNoOffenses("<div>", { fileName: "app/views/pages/broken.erb", allowInvalidSyntax: true })
  })
})
