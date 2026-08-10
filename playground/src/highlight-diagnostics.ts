import { Highlighter, generateStylesheet, resolveTheme } from "@herb-tools/highlighter"
import { Location, isDiagnosticSeverity } from "@herb-tools/core"

import type { HerbBackend, Diagnostic } from "@herb-tools/core"

const DARK_THEME = "onedark"
const LIGHT_THEME = "github-light"
const THEME_PAIR_LABEL = `${DARK_THEME}:${LIGHT_THEME}`
const STYLE_ID = "herb-highlighter-styles"

export type EditorDiagnostic = {
  message: string
  severity: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  source?: string
  code?: string
}

let highlighterSetup: Promise<Highlighter | null> | null = null

export function loadDiagnosticsHighlighter(herb: HerbBackend): Promise<Highlighter | null> {
  if (!highlighterSetup) {
    highlighterSetup = (async () => {
      const highlighter = new Highlighter(DARK_THEME, herb)
      await highlighter.initialize()
      injectHighlighterStylesheet()
      return highlighter
    })().catch((error) => {
      console.warn("Highlighted diagnostics unavailable:", error)
      return null
    })
  }

  return highlighterSetup
}

function injectHighlighterStylesheet() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = generateStylesheet(resolveTheme(DARK_THEME), THEME_PAIR_LABEL, {
    scheme: resolveTheme(LIGHT_THEME),
    label: LIGHT_THEME,
  })

  document.head.appendChild(style)
}

function toDiagnostic(diagnostic: EditorDiagnostic): Diagnostic {
  const line = diagnostic.line || 1
  const column = diagnostic.column || 0

  return {
    message: diagnostic.message,
    severity: isDiagnosticSeverity(diagnostic.severity) ? diagnostic.severity : "info",
    code: diagnostic.code,
    source: diagnostic.source,
    location: Location.from(line, column, diagnostic.endLine || line, diagnostic.endColumn ?? column + 1),
  }
}

export function renderDiagnosticHTML(highlighter: Highlighter, source: string, diagnostic: EditorDiagnostic): string {
  const suffix = diagnostic.source?.trim()

  const document = highlighter.buildDocument("playground.html.erb", source, {
    diagnostics: [toDiagnostic(diagnostic)],
    splitDiagnostics: true,
    contextLines: 2,
    suffixBuilder: () => suffix,
  })

  return highlighter.renderHTML(document, {
    themeLabel: DARK_THEME,
    showLineNumbers: true,
    markers: "spans",
    messageStyle: "hover",
  })
}
