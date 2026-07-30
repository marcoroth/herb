import { Location, type SerializedLocation } from "./location.js"

import type { DiagnosticSeverity, DiagnosticTag } from "./diagnostic.js"

export interface SerializedLintOffense {
  rule: string
  code: string
  source: string
  message: string
  severity: DiagnosticSeverity
  location: SerializedLocation
  tags?: DiagnosticTag[]
}

export interface SerializedAutofixResult {
  source: string
  fixed: SerializedLintOffense[]
  unfixed: SerializedLintOffense[]
}

export interface SerializedLintResult {
  offenses: SerializedLintOffense[]
  errors: number
  warnings: number
  info: number
  hints: number
  ignored: number
}

export class BackendLintOffense {
  readonly rule: string
  readonly code: string
  readonly source: string
  readonly message: string
  readonly severity: DiagnosticSeverity
  readonly location: Location
  readonly tags?: DiagnosticTag[]

  constructor(
    rule: string,
    code: string,
    source: string,
    message: string,
    severity: DiagnosticSeverity,
    location: Location,
    tags?: DiagnosticTag[],
  ) {
    this.rule = rule
    this.code = code
    this.source = source
    this.message = message
    this.severity = severity
    this.location = location
    this.tags = tags
  }

  static from(offense: SerializedLintOffense): BackendLintOffense {
    return new BackendLintOffense(
      offense.rule,
      offense.code,
      offense.source,
      offense.message,
      offense.severity,
      Location.from(offense.location),
      offense.tags,
    )
  }

  get isError(): boolean {
    return this.severity === "error"
  }

  get isWarning(): boolean {
    return this.severity === "warning"
  }

  get isInfo(): boolean {
    return this.severity === "info"
  }

  get isHint(): boolean {
    return this.severity === "hint"
  }

  toHash(): SerializedLintOffense {
    return {
      rule: this.rule,
      code: this.code,
      source: this.source,
      message: this.message,
      severity: this.severity,
      location: this.location.toHash(),
      ...(this.tags ? { tags: this.tags } : {}),
    }
  }

  toJSON(): SerializedLintOffense {
    return this.toHash()
  }

  inspect(): string {
    return `#<Herb::BackendLintOffense rule=${JSON.stringify(this.rule)} severity=${JSON.stringify(this.severity)} message=${JSON.stringify(this.message)} location=${this.location.treeInspect()}>`
  }

  toString(): string {
    return this.inspect()
  }
}

export class BackendLintResult {
  readonly offenses: BackendLintOffense[]
  readonly errors: number
  readonly warnings: number
  readonly info: number
  readonly hints: number
  readonly ignored: number

  constructor(
    offenses: BackendLintOffense[],
    errors: number,
    warnings: number,
    info: number,
    hints: number,
    ignored: number,
  ) {
    this.offenses = offenses
    this.errors = errors
    this.warnings = warnings
    this.info = info
    this.hints = hints
    this.ignored = ignored
  }

  static from(result: SerializedLintResult): BackendLintResult {
    const offenses = (result.offenses || []).map((offense) => BackendLintOffense.from(offense))

    return new BackendLintResult(
      offenses,
      result.errors || 0,
      result.warnings || 0,
      result.info || 0,
      result.hints || 0,
      result.ignored || 0,
    )
  }

  get offenseCount(): number {
    return this.offenses.length
  }

  get clean(): boolean {
    return this.offenses.length === 0
  }

  toHash(): SerializedLintResult {
    return {
      offenses: this.offenses.map((offense) => offense.toHash()),
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      hints: this.hints,
      ignored: this.ignored,
    }
  }

  toJSON(): SerializedLintResult {
    return this.toHash()
  }

  inspect(): string {
    return `#<Herb::BackendLintResult offenses=${this.offenseCount} errors=${this.errors} warnings=${this.warnings} info=${this.info} hints=${this.hints}>`
  }

  toString(): string {
    return this.inspect()
  }
}

export class BackendAutofixResult {
  readonly source: string
  readonly fixed: BackendLintOffense[]
  readonly unfixed: BackendLintOffense[]

  constructor(source: string, fixed: BackendLintOffense[], unfixed: BackendLintOffense[]) {
    this.source = source
    this.fixed = fixed
    this.unfixed = unfixed
  }

  static from(result: SerializedAutofixResult): BackendAutofixResult {
    return new BackendAutofixResult(
      result.source,
      (result.fixed ?? []).map(BackendLintOffense.from),
      (result.unfixed ?? []).map(BackendLintOffense.from),
    )
  }
}
