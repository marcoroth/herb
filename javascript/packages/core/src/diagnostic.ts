import { Location, SerializedLocation } from "./location.js"

export const DIAGNOSTIC_SEVERITIES = ["error", "warning", "info", "hint"] as const

export type DiagnosticSeverity = typeof DIAGNOSTIC_SEVERITIES[number]
export type DiagnosticTag = "unnecessary" | "deprecated"

export function isDiagnosticSeverity(value: string): value is DiagnosticSeverity {
  return (DIAGNOSTIC_SEVERITIES as readonly string[]).includes(value)
}

export function meetsSeverityThreshold(severity: DiagnosticSeverity, threshold: DiagnosticSeverity): boolean {
  return DIAGNOSTIC_SEVERITIES.indexOf(severity) <= DIAGNOSTIC_SEVERITIES.indexOf(threshold)
}

/**
 * Base interface for all diagnostic information in Herb tooling.
 * This includes parser errors, lexer errors, lint offenses, and any other
 * issues that need to be reported to users.
 */
export interface Diagnostic {
  /**
   * The diagnostic message describing the issue
   */
  message: string

  /**
   * The location in the source where this diagnostic applies
   */
  location: Location

  /**
   * The severity level of the diagnostic
   */
  severity: DiagnosticSeverity

  /**
   * Optional diagnostic code for categorization (e.g., "E0001", "W0042")
   */
  code?: string

  /**
   * Optional source that generated this diagnostic (e.g., "parser", "linter", "lexer")
   */
  source?: string

  /**
   * Optional diagnostic tags for additional metadata (e.g., "unnecessary", "deprecated")
   */
  tags?: DiagnosticTag[]
}

/**
 * Serialized form of a Diagnostic for JSON representation
 */
export interface SerializedDiagnostic {
  message: string
  location: SerializedLocation
  severity: DiagnosticSeverity
  code?: string
  source?: string
  tags?: DiagnosticTag[]
}

/**
 * Rebuilds a `Diagnostic` from its serialized form.
 *
 * @param diagnostic - The serialized diagnostic to rebuild
 * @returns The diagnostic with its `Location` restored
 */
export function deserializeDiagnostic(diagnostic: SerializedDiagnostic): Diagnostic {
  return { ...diagnostic, location: Location.from(diagnostic.location) }
}

export type MonacoSeverity = "error" | "warning" | "info"

/**
 * Monaco/VSCode-compatible diagnostic format for editor integration
 */
export type MonacoDiagnostic = {
  line: number
  column: number
  endLine: number
  endColumn: number
  message: string
  severity: MonacoSeverity
}

/**
 * Converts a Diagnostic to Monaco/VSCode-compatible MonacoDiagnostic format
 */
export function toMonacoDiagnostic(diagnostic: Diagnostic): MonacoDiagnostic {
  const { message, location } = diagnostic

  const severity: MonacoSeverity = diagnostic.severity === "hint" ? "info" : diagnostic.severity

  return {
    line: location.start.line,
    column: location.start.column,
    endLine: location.end.line,
    endColumn: location.end.column,
    message,
    severity
  }
}
