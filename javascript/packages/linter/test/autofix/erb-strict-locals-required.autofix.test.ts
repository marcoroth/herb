import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBStrictLocalsRequiredRule } from "../../src/rules/erb-strict-locals-required.js"
import { callerIndexWithLocals } from "../helpers/partial-caller-context.js"

describe("erb-strict-locals-required autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("does not apply unsafe fix by default", () => {
    const input = '<div>Content</div>'

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_partial.html.erb', framework: "actionview" })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("adds empty strict locals declaration with --fix-unsafely", () => {
    const input = '<div>Content</div>'
    const expected = '<%# locals: (**) %>\n\n<div>Content</div>'

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_partial.html.erb', framework: "actionview" }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify files that already have strict locals", () => {
    const input = dedent`
      <%# locals: (user:) %>
      <div><%= user.name %></div>
    `

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_partial.html.erb', framework: "actionview" }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify non-partial files", () => {
    const input = '<div>Content</div>'

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: 'show.html.erb', framework: "actionview" }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("handles multi-line files", () => {
    const input = dedent`
      <div class="card">
        <h2>Title</h2>
        <p>Content</p>
      </div>
    `

    const expected = `<%# locals: (**) %>\n\n${input}`

    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const result = linter.autofix(input, { fileName: '_card.html.erb', framework: "actionview" }, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("names the locals every call site passes", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [
      { caller: "app/views/posts/index.html.erb", locals: ["title"] },
      { caller: "app/views/home/show.html.erb", locals: ["title", "footer"] },
    ])

    const result = linter.autofix("<h1><%= title %></h1>", { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toBe('<%# locals: (footer: nil, title: nil) %>\n\n<h1><%= title %></h1>')
  })

  test("names a local the body uses that no call site passes", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: ["title"] }])

    const result = linter.autofix("<h1><%= title %></h1><p><%= subtitle %></p>", { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (subtitle: nil, title: nil) %>")
  })

  test("does not name a helper, a predicate or a route helper", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: [] }])

    const source = '<%= link_to "x", posts_path %><% if admin? %><span><%= title %></span><% end %>'
    const result = linter.autofix(source, { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (title: nil) %>")
  })

  test("names a local sharing its name with a form builder only helper", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: [] }])

    const source = '<%= link_to button.title, button.path %><%= submit %>'
    const result = linter.autofix(source, { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (button: nil, submit: nil) %>")
  })

  test("does not name the top level counterparts of form builder helpers", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: [] }])

    const source = '<%= button_tag "Save" %><%= submit_tag "Go" %><span><%= title %></span>'
    const result = linter.autofix(source, { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (title: nil) %>")
  })

  test("does not name a variable bound inside the partial", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: ["posts"] }])

    const source = '<% posts.each do |post| %><span><%= post %></span><% end %>'
    const result = linter.autofix(source, { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (posts: nil) %>")
  })

  test("keeps keyword rest when the partial reads local_assigns", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: ["title"] }])

    const source = '<%= title %><%= local_assigns[:extra] %>'
    const result = linter.autofix(source, { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (title: nil, **) %>")
  })

  test("keeps keyword rest when the project has unresolved renders", () => {
    const linter = new Linter(Herb, [ERBStrictLocalsRequiredRule])
    const partial = "app/views/posts/_card.html.erb"

    const callers = callerIndexWithLocals(partial, [{ caller: "app/views/posts/index.html.erb", locals: ["title"] }], 1)

    const result = linter.autofix("<h1><%= title %></h1>", { fileName: partial, framework: "actionview", partialCallers: callers }, undefined, { includeUnsafe: true })

    expect(result.source).toContain("<%# locals: (title: nil, **) %>")
  })
})
