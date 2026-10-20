export const FORMAT_OPTIONS = ["simple", "detailed", "json", "junit"] as const

export type FormatOption = typeof FORMAT_OPTIONS[number]
export type StructuredFormat = Extract<FormatOption, "json" | "junit">

export interface OutputTarget {
  format: FormatOption
  path?: string
}

export function isStructuredFormat(format: FormatOption): format is StructuredFormat {
  return format === "json" || format === "junit"
}
