export type DiagnosticSeverity = "error" | "warning" | "info" | "hint"

export interface DiagnosticPosition {
  line: number
  column: number
}

export interface DiagnosticLocation {
  start: DiagnosticPosition
}

export interface DiagnosticSpot {
  location?: DiagnosticLocation
}

// TODO: this should probably just import the type from the dev-tools or core
export interface RuntimeDiagnostic extends DiagnosticSpot {
  template: string
  message: string
  code?: string
  severity?: DiagnosticSeverity
  origin?: string
  suggestion?: string
  value?: string
  overlay?: "blocking" | "dismissible" | false
  element?: Element | null
}

export interface DevToolsGlobal {
  report?(input: RuntimeDiagnostic | RuntimeDiagnostic[]): unknown
  clear?(origin?: string): void
}
