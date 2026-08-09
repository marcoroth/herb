import { REQUIRED_COLOR_SCHEME_KEYS, OPTIONAL_COLOR_SCHEME_KEYS } from "./themes.js"
import { kebab } from "./html-sink.js"

import type { ColorScheme } from "./themes.js"
import type { Color } from "./color.js"

export interface LightTheme {
  scheme: ColorScheme
  label: string
}

const NAMED_COLOR_HEX: Record<string, string> = {
  black: "#000000",
  red: "#CD3131",
  green: "#0DBC79",
  yellow: "#E5E510",
  blue: "#2472C8",
  magenta: "#BC3FBC",
  cyan: "#11A8CD",
  white: "#E5E5E5",
  gray: "#666666",
  brightRed: "#F14C4C",
  brightGreen: "#23D18B",
  brightYellow: "#F5F543",
  brightBlue: "#3B8EEA",
  brightMagenta: "#D670D6",
  brightCyan: "#29B8DB",
  bgBlack: "#000000",
  bgRed: "#CD3131",
  bgGreen: "#0DBC79",
  bgYellow: "#E5E510",
  bgBlue: "#2472C8",
  bgMagenta: "#BC3FBC",
  bgCyan: "#11A8CD",
  bgWhite: "#E5E5E5",
  bgGray: "#666666",
  reset: "inherit",
  bold: "inherit",
  dim: "inherit",
}

const DIAGNOSTIC_RULES = `.herb-highlight .herb-severity-label { font-weight: bold; }
.herb-highlight .herb-severity-label.herb-severity-error { color: var(--herb-severity-error, #F14C4C); }
.herb-highlight .herb-severity-label.herb-severity-warning { color: var(--herb-severity-warning, #F5F543); }
.herb-highlight .herb-severity-label.herb-severity-info { color: var(--herb-severity-info, #11A8CD); }
.herb-highlight .herb-severity-label.herb-severity-hint { color: var(--herb-severity-hint, #666666); }

.herb-highlight .herb-diagnostic-header {
  display: block;
  margin: 0 0 0.75em;
}

.herb-highlight .herb-diagnostic-message code {
  padding: 0 0.25em;
  border-radius: 3px;
  background-color: var(--herb-inline-code-bg, rgba(127, 127, 127, 0.18));
}

.herb-highlight .herb-diagnostic-code {
  opacity: 0.7;
}

.herb-highlight .herb-diagnostic-suffix {
  opacity: 0.7;
}

.herb-highlight .herb-annotation-message {
  display: block;
  user-select: none;
  opacity: 0.85;
}

.herb-highlight .herb-line-marked[data-line]::before {
  font-weight: bold;
}

.herb-highlight a {
  color: inherit;
}

.herb-highlight mark.herb-marker {
  color: inherit;
  background-color: transparent;
  text-decoration: underline wavy;
  text-decoration-skip-ink: none;
}

.herb-highlight mark.herb-marker-error { background-color: var(--herb-marker-error-bg, rgba(241, 76, 76, 0.15)); text-decoration-color: var(--herb-severity-error, #F14C4C); }
.herb-highlight mark.herb-marker-warning { background-color: var(--herb-marker-warning-bg, rgba(245, 245, 67, 0.15)); text-decoration-color: var(--herb-severity-warning, #F5F543); }
.herb-highlight mark.herb-marker-info { background-color: var(--herb-marker-info-bg, rgba(17, 168, 205, 0.15)); text-decoration-color: var(--herb-severity-info, #11A8CD); }
.herb-highlight mark.herb-marker-hint { background-color: var(--herb-marker-hint-bg, rgba(102, 102, 102, 0.15)); text-decoration-color: var(--herb-severity-hint, #666666); }

::highlight(herb-marker-error) { background-color: var(--herb-marker-error-bg, rgba(241, 76, 76, 0.15)); text-decoration: underline wavy var(--herb-severity-error, #F14C4C); }
::highlight(herb-marker-warning) { background-color: var(--herb-marker-warning-bg, rgba(245, 245, 67, 0.15)); text-decoration: underline wavy var(--herb-severity-warning, #F5F543); }
::highlight(herb-marker-info) { background-color: var(--herb-marker-info-bg, rgba(17, 168, 205, 0.15)); text-decoration: underline wavy var(--herb-severity-info, #11A8CD); }
::highlight(herb-marker-hint) { background-color: var(--herb-marker-hint-bg, rgba(102, 102, 102, 0.15)); text-decoration: underline wavy var(--herb-severity-hint, #666666); }

.herb-progress-rule {
  position: relative;
  margin: 1.5em 0;
  border: none;
  border-top: 1px solid var(--herb-rule, rgba(127, 127, 127, 0.4));
}

.herb-progress-rule::after {
  content: attr(data-herb-progress);
  position: absolute;
  top: -0.75em;
  right: 1em;
  padding: 0 0.5em;
  font-size: 0.8em;
  color: var(--herb-rule-label, #666666);
  background-color: var(--herb-rule-label-bg, Canvas);
}

.herb-highlight .herb-line[data-old-line]::before,
.herb-highlight .herb-line[data-new-line]::before {
  display: inline-block;
  width: 3ch;
  margin-right: 1ch;
  text-align: right;
  color: var(--herb-line-number, #666666);
  user-select: none;
}

.herb-highlight .herb-diff-context[data-old-line]::before { content: attr(data-old-line); }
.herb-highlight .herb-diff-removed[data-old-line]::before { content: attr(data-old-line); color: var(--herb-severity-error, #F14C4C); }
.herb-highlight .herb-diff-added[data-new-line]::before { content: attr(data-new-line); color: var(--herb-diff-added-number, #0DBC79); }

.herb-highlight .herb-diff-context {
  opacity: 0.75;
}

.herb-highlight .herb-diff-added {
  background-color: var(--herb-diff-added-line-background, rgba(13, 188, 121, 0.12));
}

.herb-highlight .herb-diff-removed {
  background-color: var(--herb-diff-removed-line-background, rgba(241, 76, 76, 0.12));
}

.herb-highlight mark.herb-diff-inline-added {
  color: inherit;
  background-color: var(--herb-diff-added-background, rgba(13, 188, 121, 0.35));
}

.herb-highlight mark.herb-diff-inline-removed {
  color: inherit;
  background-color: var(--herb-diff-removed-background, rgba(241, 76, 76, 0.35));
}

.herb-highlight .herb-diff-hunk-separator::before {
  content: "⋮";
  display: inline-block;
  width: 3ch;
  margin-right: 1ch;
  text-align: right;
  color: var(--herb-line-number, #666666);
  user-select: none;
}

.herb-highlight .herb-diff-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 1.5em;
}

.herb-highlight .herb-diff-column {
  margin: 0;
  white-space: pre;
  overflow-x: auto;
}

.herb-highlight .herb-diff-column-new {
  border-left: 1px solid var(--herb-rule, rgba(127, 127, 127, 0.4));
  padding-left: 1.5em;
}

.herb-highlight .herb-diff-empty {
  display: block;
}

.herb-highlight.herb-messages-hover .herb-line-marked {
  position: relative;
}

.herb-highlight.herb-messages-hover .herb-annotation-message {
  display: none;
  position: absolute;
  left: 5ch;
  top: 100%;
  z-index: 1;
  width: max-content;
  max-width: 60ch;
  padding: 0.5em 0.75em;
  border: 1px solid var(--herb-rule, rgba(127, 127, 127, 0.4));
  border-radius: 6px;
  background-color: var(--herb-tooltip-bg, Canvas);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  white-space: normal;
}

.herb-highlight.herb-messages-hover .herb-line-marked:hover .herb-annotation-message,
.herb-highlight.herb-messages-hover .herb-line-marked:focus-within .herb-annotation-message {
  display: block;
}`

function cssColor(color: Color): string {
  if (color.startsWith("#")) {
    return color.toUpperCase()
  }

  return NAMED_COLOR_HEX[color]
}

function propertyBlock(scheme: ColorScheme, indent: string): string {
  const lines: string[] = []

  const pushProperty = (key: keyof ColorScheme) => {
    const value = scheme[key]

    if (value !== null && value !== undefined) {
      lines.push(`${indent}--herb-${kebab(key)}: ${cssColor(value)};`)
    }
  }

  for (const key of REQUIRED_COLOR_SCHEME_KEYS) {
    pushProperty(key)
  }

  for (const key of OPTIONAL_COLOR_SCHEME_KEYS) {
    pushProperty(key)
  }

  lines.push(`${indent}--herb-attr-name: #D19A66;`)
  lines.push(`${indent}--herb-attr-value: #98C379;`)

  return lines.join("\n")
}

export function generateStylesheet(dark: ColorScheme, label: string, light?: LightTheme): string {
  const tokenRules = REQUIRED_COLOR_SCHEME_KEYS
    .map(key => `.herb-highlight .herb-${kebab(key)} { color: var(--herb-${kebab(key)}); }`)
    .join("\n")

  const sections = [
    `/* herb-highlight theme: ${label} */`,
    `.herb-highlight {\n  margin: 0;\n}`,
    `.herb-highlight .herb-file-header {\n  color: var(--herb-file-header, #11A8CD);\n}`,
    `.herb-highlight .herb-code {\n  margin: 0;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}`,
    `.herb-highlight .herb-line[data-line]::before {\n  content: attr(data-line);\n  display: inline-block;\n  width: 3ch;\n  margin-right: 1ch;\n  text-align: right;\n  color: var(--herb-line-number, #666666);\n  user-select: none;\n}`,
    `.herb-highlight .herb-line-dimmed {\n  opacity: 0.6;\n}`,
    `.herb-highlight .herb-line-focus[data-line]::before {\n  color: var(--herb-line-number-focus, #11A8CD);\n  font-weight: bold;\n}`,
    tokenRules,
    `.herb-highlight .herb-tag-name { color: var(--herb-token-html-tag-start); }\n.herb-highlight .herb-attr-name { color: var(--herb-attr-name); }\n.herb-highlight .herb-attr-value { color: var(--herb-attr-value); }\n.herb-highlight .herb-comment { color: var(--herb-token-html-comment-start); }`,
    DIAGNOSTIC_RULES,
    `.herb-highlight {\n${propertyBlock(dark, "  ")}\n}`,
  ]

  if (light) {
    sections.push(`@media (prefers-color-scheme: light) {\n  .herb-highlight {\n${propertyBlock(light.scheme, "    ")}\n  }\n}`)
    sections.push(`.herb-highlight[data-herb-appearance="dark"] {\n${propertyBlock(dark, "  ")}\n}`)
    sections.push(`.herb-highlight[data-herb-appearance="light"] {\n${propertyBlock(light.scheme, "  ")}\n}`)
  }

  return `${sections.join("\n\n")}\n`
}
