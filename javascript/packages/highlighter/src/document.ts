import type { DiagnosticSeverity } from "@herb-tools/core"

export type StyleRole =
  | { kind: "Plain" }
  | { kind: "Token"; tokenType: string }
  | { kind: "RubyKeyword" }
  | { kind: "TagName" }
  | { kind: "AttributeName" }
  | { kind: "AttributeValue" }
  | { kind: "CommentInterior" }

export interface StyledRun {
  text: string
  role: StyleRole
}

export interface Document {
  version: 1
  nodes: Node[]
}

export interface FileHeaderNode {
  type: "FileHeader"
  path: string
  line: number | null
  column: number | null
  url: string | null
}

export interface DiagnosticHeaderNode {
  type: "DiagnosticHeader"
  severity: DiagnosticSeverity
  message: string
  code: string | null
  codeUrl: string | null
  suffix: string | null
}

export interface CodeBlockNode {
  type: "CodeBlock"
  kind: CodeBlockKind
  firstLine: number
  runs: StyledRun[]
  lines: LineInfo[]
}

export interface ProgressRuleNode {
  type: "ProgressRule"
  index: number
  total: number
}

export type Node =
  | FileHeaderNode
  | DiagnosticHeaderNode
  | CodeBlockNode
  | ProgressRuleNode

export type CodeBlockKind = "Listing" | "AnnotatedListing" | "Excerpt"

export interface LineInfo {
  number: number
  emphasis: LineEmphasis
  annotations: Annotation[]
}

export type LineEmphasis =
  | { kind: "Normal" }
  | { kind: "Dimmed" }
  | { kind: "Focus" }
  | { kind: "Marked"; severity: DiagnosticSeverity }

export interface Annotation {
  start: number
  end: number
  severity: DiagnosticSeverity
  message: AnnotationMessage | null
}

export interface AnnotationMessage {
  text: string
  code: string | null
  codeUrl: string | null
}
