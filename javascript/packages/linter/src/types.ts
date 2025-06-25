import { Location } from "@herb-tools/core"

export interface LintMessage {
  rule: string
  message: string
  location: Location
  severity: "error" | "warning"
}

export interface LintResult {
  messages: LintMessage[]
  errors: number
  warnings: number
}

export interface Rule {
  name: string
  description: string
  check(node: any): LintMessage[]
}
