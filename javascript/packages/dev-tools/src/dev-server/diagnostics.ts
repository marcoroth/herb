import type { SlotsRequestFailure } from "@herb-tools/client"

import type { ErrorMessage } from "./types"
import type { RuntimeDiagnostic } from "../runtime/report"

export const DEV_SERVER_ORIGIN = "Herb Dev Server"

export function diagnosticsFromError(message: ErrorMessage): RuntimeDiagnostic[] {
  return message.errors.map((error) => ({
    template: message.file,
    message: error.message,
    code: error.code ?? error.name,
    severity: "error" as const,
    origin: error.origin ?? DEV_SERVER_ORIGIN,
    phase: "compile" as const,
    overlay: "dismissible" as const,
    location: { start: { line: error.line, column: error.column + 1 } },
    ...(error.suggestion ? { suggestion: error.suggestion } : {}),
    ...(message.source === undefined ? {} : { source: message.source }),
  }))
}

export function diagnosticFromBrokenTemplate(file: string): RuntimeDiagnostic {
  return {
    template: file,
    message: "This template did not parse when the dev server started. Edit it to see the errors.",
    severity: "error" as const,
    origin: DEV_SERVER_ORIGIN,
    phase: "compile" as const,
    overlay: "dismissible" as const,
  }
}

export function diagnosticFromRefreshFailure(file: string, status: number, failure: SlotsRequestFailure | null): RuntimeDiagnostic {
  return {
    template: failure?.template ?? file,
    message: failure?.message ?? `The application answered ${status} while re-rendering. Check the server log.`,
    code: failure?.class ?? "RuntimeError",
    severity: "error" as const,
    origin: "Web Application",
    phase: "runtime" as const,
    overlay: "dismissible" as const,
    ...(failure?.line ? { location: { start: { line: failure.line, column: 1 } } } : {}),
    ...(failure?.backtrace?.length ? { backtrace: failure.backtrace } : {}),
  }
}
