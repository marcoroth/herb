export const FORMAT_OPTIONS = ["simple", "detailed", "json"] as const

export type FormatOption = typeof FORMAT_OPTIONS[number]

export interface OutputTarget {
  format: FormatOption
  path?: string
}

export function isStructuredFormat(format: FormatOption): format is "json" {
  return format === "json"
}
