import type { ErrorMessage } from "./types"
import type { RuntimeDiagnostic } from "../runtime/report"

export const DEV_SERVER_ORIGIN = "Herb Dev Server"

export function diagnosticsFromError(message: ErrorMessage): RuntimeDiagnostic[] {
  return message.errors.map((error) => ({
    template: message.file,
    message: error.message,
    code: error.name,
    severity: "error" as const,
    origin: DEV_SERVER_ORIGIN,
    phase: "compile" as const,
    overlay: "dismissible" as const,
    location: { start: { line: error.line, column: error.column + 1 } },
  }))
}
