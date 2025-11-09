import { DiagnosticSeverity } from "@herb-tools/core"

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
  bgGray: "\x1b[100m",
} as const

export type Color = keyof typeof colors | `#${string}`

const hexToAnsi = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  return `\x1b[38;2;${r};${g};${b}m`
}

export const colorize = (
  text: string,
  color: Color,
  backgroundColor?: Color,
): string => {
  if (process.env.NO_COLOR === undefined) {
    let foreground: string
    let background = ""

    if (typeof color === "string" && color.startsWith("#")) {
      foreground = hexToAnsi(color)
    } else {
      foreground = colors[color as keyof typeof colors]
    }

    if (backgroundColor) {
      if (
        typeof backgroundColor === "string" &&
        backgroundColor.startsWith("#")
      ) {
        // Convert hex to background color (48 instead of 38 for background)
        const r = parseInt(backgroundColor.slice(1, 3), 16)
        const g = parseInt(backgroundColor.slice(3, 5), 16)
        const b = parseInt(backgroundColor.slice(5, 7), 16)

        background = `\x1b[48;2;${r};${g};${b}m`
      } else {
        background = colors[backgroundColor as keyof typeof colors]
      }
    }

    return `${background}${foreground}${text}${colors.reset}`
  }

  return text
}

export const severityColor = (severity: DiagnosticSeverity): Color => {
  switch (severity) {
    case "error": return "brightRed"
    case "warning": return "brightYellow"
    case "info": return "cyan"
    case "hint": return "gray"
    default: return "brightYellow"
  }
}
