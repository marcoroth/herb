import type { SerializedLocation } from "./location.js"

export type DiagnosticLevel = "error" | "warning"

export interface Diagnostic {
  id: string
  message: string
  severity: DiagnosticLevel
  location: SerializedLocation
}
