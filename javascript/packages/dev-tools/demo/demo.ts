import { HerbDevTools } from "@herb-tools/dev-tools"

import type { RuntimeReportHandle } from "@herb-tools/dev-tools"

const devTools = HerbDevTools.start({ devServer: false })!

let lastHandle: RuntimeReportHandle | null = null

function on(id: string, handler: () => void) {
  document.getElementById(id)!.addEventListener("click", handler)
}

on("report-one", () => {
  lastHandle = devTools.report({
    template: "app/views/posts/index.html.erb",
    node: "1",
    message: "Focus left the dialog while it was still open.",
    code: "a11y-focus-trap",
    severity: "warning",
    origin: "Acme Scanner",
    location: { start: { line: 4, column: 3 }, end: { line: 4, column: 29 } },
    suggestion: "Return focus to the trigger when the dialog closes.",
    docsUrl: "https://herb-tools.dev/linter/rules/a11y-focus-trap",
  })
})

on("report-batch", () => {
  lastHandle = devTools.report([
    {
      template: "app/views/posts/_post.html.erb",
      node: "3",
      message: "Cover image loaded 1.4 MB over the wire.",
      kind: "metric",
      origin: "Acme Scanner",
      value: "1.4 MB",
      location: { start: { line: 1, column: 1 } },
    },
    {
      template: "app/views/layouts/application.html.erb",
      node: "0",
      message: "The layout rendered before the stylesheet finished loading.",
      code: "runtime-flash-of-unstyled-content",
      severity: "info",
      origin: "Acme Scanner",
    },
  ])
})

on("report-repeat", () => {
  lastHandle = devTools.report({
    template: "app/views/posts/index.html.erb",
    node: "1",
    message: "Focus left the dialog while it was still open.",
    code: "a11y-focus-trap",
    severity: "warning",
    origin: "Acme Scanner",
    location: { start: { line: 4, column: 3 } },
  })
})

on("report-spaced", () => {
  lastHandle = devTools.report({
    template: "app/views/posts/index.html.erb",
    node: "1",
    message: "Sent with a stray space in origin.",
    code: "demo-trailing-space",
    severity: "info",
    origin: "Acme Scanner ",
  })
})

on("report-metrics", () => {
  const templates = ["app/views/posts/index.html.erb", "app/views/posts/_post.html.erb", "app/components/post_actions_component.html.erb"]

  const renders = templates.flatMap((template, index) => [3, 7, 11, 18].map((line, position) => ({
    template,
    message: `This tag rendered once, taking ${(0.4 + index + position).toFixed(1)} ms and allocating ${(1200 * (position + 1)).toLocaleString("en-US")} objects.`,
    code: "render-time",
    kind: "metric" as const,
    origin: "Herb Engine",
    value: `${(0.4 + index + position).toFixed(1)} ms`,
    location: { start: { line, column: 3 } },
    data: { render: [{ duration: 0.4 + index + position, gc: 0.1, allocations: 1200 * (position + 1) }] },
  })))

  const queries = [4, 9].map(line => ({
    template: "app/views/posts/index.html.erb",
    message: "This ERB tag ran 5 SQL queries while the page rendered.",
    code: "sql-queries",
    kind: "metric" as const,
    origin: "Herb Engine",
    value: "5 SQL queries",
    location: { start: { line, column: 5 } },
    data: {
      queries: [
        `SELECT "posts".* FROM "posts" WHERE "posts"."published" = 1 ORDER BY "posts"."created_at" DESC LIMIT 10`,
        `SELECT "users".* FROM "users" WHERE "users"."id" = 1 LIMIT 1`,
        `SELECT COUNT(*) FROM "comments" WHERE "comments"."post_id" = 1`,
      ],
    },
  }))

  const rendered = ["Latest posts", "Neueste Beiträge"].map((value, index) => ({
    template: "app/views/posts/index.html.erb",
    message: value,
    code: "rendered-output",
    kind: "value" as const,
    origin: "Herb Engine",
    value,
    location: { start: { line: 2 + index, column: 5 } },
  }))

  lastHandle = devTools.report([...renders, ...queries, ...rendered])
})

on("report-blocking", () => {
  lastHandle = devTools.report({
    template: "app/views/posts/_post.html.erb",
    message: "Unclosed `<form>` element. The template could not be compiled.",
    code: "html-missing-closing-tag",
    severity: "error",
    origin: "Herb Parser",
    location: { start: { line: 2, column: 3 }, end: { line: 2, column: 47 } },
    suggestion: "Close the `<form>` before the `</article>` on line 11.",
    overlay: "blocking",
  })
})

on("report-dismissible", () => {
  lastHandle = devTools.report({
    template: "app/components/post_actions_component.html.erb",
    message: "This slot could not be hydrated. The page is showing server-rendered markup.",
    code: "slot-hydration-failed",
    severity: "error",
    origin: "Herb Client Runtime",
    location: { start: { line: 2, column: 3 } },
    suggestion: "Check that the slot markers survived the server response.",
    overlay: "dismissible",
  })
})

on("report-located", () => {
  const posts = document.querySelectorAll<HTMLElement>("article.post")

  lastHandle = devTools.report([
    {
      template: "app/views/posts/_post.html.erb",
      node: "3",
      message: "Cover image has no intrinsic size, so the page reflows once it loads.",
      code: "html-img-require-dimensions",
      severity: "warning",
      origin: "Acme Scanner",
      location: { start: { line: 1, column: 1 } },
      suggestion: "Give the cover an explicit `width` and `height`.",
      element: document.getElementById("cover-three"),
    },
    {
      template: "app/views/posts/_post.html.erb",
      node: "3",
      message: "This partial rendered without a byline.",
      code: "demo-missing-byline",
      severity: "info",
      origin: "Acme Scanner",
      location: { start: { line: 1, column: 1 } },
      element: posts[1] ?? null,
    },
    {
      template: "app/views/posts/_draft.html.erb",
      node: "6",
      message: "Draft cover has no alt text.",
      code: "html-img-require-alt",
      severity: "warning",
      origin: "Acme Scanner",
      location: { start: { line: 1, column: 1 } },
      element: document.getElementById("cover-four"),
    },
  ])
})

on("dismiss-last", () => {
  lastHandle?.dismiss()
  lastHandle = null
})

on("open-panel", () => devTools.open())
on("open-expanded", () => devTools.open({ expanded: true }))
on("close-panel", () => devTools.close())
on("clear-origin", () => devTools.clear("Acme Scanner"))
on("clear-all", () => devTools.clear())
on("unhide", () => devTools.show({ open: true }))

on("toggle-expand", () => {
  const panel = devTools.runtimePanel

  if (panel === null) return

  panel.show({ open: true })

  if (panel.expanded) {
    panel.collapse()
  } else {
    panel.expand()
  }
})
