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

on("dismiss-last", () => {
  lastHandle?.dismiss()
  lastHandle = null
})

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
