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
    `.herb-highlight {\n${propertyBlock(dark, "  ")}\n}`,
  ]

  if (light) {
    sections.push(`@media (prefers-color-scheme: light) {\n  .herb-highlight {\n${propertyBlock(light.scheme, "    ")}\n  }\n}`)
    sections.push(`.herb-highlight[data-herb-appearance="dark"] {\n${propertyBlock(dark, "  ")}\n}`)
    sections.push(`.herb-highlight[data-herb-appearance="light"] {\n${propertyBlock(light.scheme, "  ")}\n}`)
  }

  return `${sections.join("\n\n")}\n`
}
