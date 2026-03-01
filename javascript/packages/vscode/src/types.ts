import * as vscode from 'vscode'

import type { LintOffense, LintSeverity, LinterRule } from '@herb-tools/linter'

export type Status = 'processing' | 'ok' | 'failed' | 'timeout' | 'formatter'

export interface FileStatus {
  uri: vscode.Uri
  status: Status
  errors: number
  lintWarnings: number
  lintErrors: number
  lintOffenses: LintOffense[]
  linterDisabled?: boolean
  formatterIssues?: boolean
  formatterDisabled?: boolean
}

export interface StatusGroup {
  type: 'statusGroup'
  status: Status
}

export interface ParseErrorGroup {
  type: 'parseErrorGroup'
}

export interface LintIssueGroup {
  type: 'lintIssueGroup'
}

export interface ParserGroup {
  type: 'parserGroup'
}

export interface FormatterIssueGroup {
  type: 'formatterIssueGroup'
}

export interface LintSeverityGroup {
  type: 'lintSeverityGroup'
  severity: LintSeverity
}

export interface LintRuleGroup {
  type: 'lintRuleGroup'
  rule: LinterRule
  severity: LintSeverity
}

export interface FolderGroup {
  type: 'folderGroup'
  status: Status
  pathSegments: string[]
}

export interface PromptNode {
  type: 'prompt'
}

export interface VersionInfoNode {
  type: 'versionInfo'
  label: string
  value: string
}

export interface SeparatorNode {
  type: 'separator'
  label: string
}

export interface TimestampNode {
  type: 'timestamp'
  label: string
  value: string
}

export interface ReportGeneralIssueNode {
  type: 'reportGeneralIssue'
}

export interface GitHubRepoNode {
  type: 'githubRepo'
}

export interface DocumentationNode {
  type: 'documentation'
}

export interface NoParseErrorsNode {
  type: 'noParseErrors'
}

export interface NoLintIssuesNode {
  type: 'noLintIssues'
}

export interface NoFormatterIssuesNode {
  type: 'noFormatterIssues'
}

export interface FormatterFileNode {
  type: 'formatterFile'
  file: FileStatus
}

export type TreeNode =
  | StatusGroup
  | ParseErrorGroup
  | LintIssueGroup
  | ParserGroup
  | FormatterIssueGroup
  | LintSeverityGroup
  | LintRuleGroup
  | FolderGroup
  | FileStatus
  | FormatterFileNode
  | PromptNode
  | VersionInfoNode
  | SeparatorNode
  | TimestampNode
  | ReportGeneralIssueNode
  | GitHubRepoNode
  | DocumentationNode
  | NoParseErrorsNode
  | NoLintIssuesNode
  | NoFormatterIssuesNode

export interface AnalysisResult {
  status: Status
  errors: number
  lintWarnings: number
  lintErrors: number
  lintOffenses: LintOffense[]
  linterDisabled: boolean
  formatterIssues: boolean
  formatterDisabled: boolean
}
