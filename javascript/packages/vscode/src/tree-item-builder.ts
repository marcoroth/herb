import * as vscode from 'vscode'
import * as path from 'path'

import type { FileStatus, TreeNode, Status, FormatterFileNode } from './types'
import type { LintSeverity } from '@herb-tools/linter'

export class TreeItemBuilder {
  constructor(private files: FileStatus[]) {}

  buildTreeItem(element: TreeNode): vscode.TreeItem {
    if ('type' in element) {
      switch (element.type) {
        case 'statusGroup':        return this.buildStatusGroupItem(element)
        case 'parseErrorGroup':    return this.buildParseErrorGroupItem()
        case 'lintIssueGroup':     return this.buildLintIssueGroupItem()
        case 'parserGroup':        return this.buildParserGroupItem()
        case 'formatterIssueGroup': return this.buildFormatterIssueGroupItem()
        case 'lintSeverityGroup':  return this.buildLintSeverityGroupItem(element)
        case 'lintRuleGroup':      return this.buildLintRuleGroupItem(element)
        case 'folderGroup':        return this.buildFolderGroupItem(element)
        case 'prompt':             return this.buildPromptItem()
        case 'versionInfo':        return this.buildVersionInfoItem(element)
        case 'separator':          return this.buildSeparatorItem(element)
        case 'timestamp':          return this.buildTimestampItem(element)
        case 'githubRepo':         return this.buildGitHubRepoItem()
        case 'reportGeneralIssue': return this.buildReportGeneralIssueItem()
        case 'documentation':      return this.buildDocumentationItem()
        case 'noParseErrors':      return this.buildNoParseErrorsItem()
        case 'noLintIssues':       return this.buildNoLintIssuesItem()
        case 'noFormatterIssues':  return this.buildNoFormatterIssuesItem()
        case 'formatterFile':      return this.buildFormatterFileItem(element)
      }
    }

    return this.buildFileItem(element as FileStatus)
  }

  private buildStatusGroupItem(element: { status: Status }): vscode.TreeItem {
    const okCount = this.files.filter(f => this.matchesGroup(f, 'ok')).length
    const failCount = this.files.filter(f => this.matchesGroup(f, 'failed')).length
    const timeoutCount = this.files.filter(f => this.matchesGroup(f, 'timeout')).length
    const processingCount = this.files.filter(f => this.matchesGroup(f, 'processing')).length

    const label =
      element.status === 'processing'
        ? `Processing (${processingCount} file${processingCount === 1 ? '' : 's'})`
        : element.status === 'ok'
        ? `Successful (${okCount} file${okCount === 1 ? '' : 's'})`
        : element.status === 'timeout'
        ? `Timed Out (${timeoutCount} file${timeoutCount === 1 ? '' : 's'})`
        : `Failed (${failCount} file${failCount === 1 ? '' : 's'})`

    const collapsibleState = element.status === 'ok' || (element.status === 'timeout' && timeoutCount === 0)
      ? vscode.TreeItemCollapsibleState.None
      : vscode.TreeItemCollapsibleState.Collapsed
    const item = new vscode.TreeItem(label, collapsibleState)

    if (element.status === 'ok') {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    } else if (element.status === 'failed') {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else if (element.status === 'timeout') {
      if (timeoutCount > 0) {
        item.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'))
      } else {
        item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
      }
    } else if (element.status === 'processing') {
      item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'))
    }

    return item
  }

  private buildParseErrorGroupItem(): vscode.TreeItem {
    const parseErrorCount = this.files.filter(f => f.errors > 0).length
    const label = `Parse Errors (${parseErrorCount} file${parseErrorCount === 1 ? '' : 's'})`

    const collapsibleState = parseErrorCount > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None

    const item = new vscode.TreeItem(label, collapsibleState)

    if (parseErrorCount > 0) {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    }

    return item
  }

  private buildLintIssueGroupItem(): vscode.TreeItem {
    const linterDisabled = this.files.some(f => f.linterDisabled)

    if (linterDisabled) {
      const item = new vscode.TreeItem(
        'Herb Linter (disabled)',
        vscode.TreeItemCollapsibleState.None
      )

      item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.gray'))
      item.tooltip = 'Linting is disabled in the Herb configuration (.herb.yml). Click to toggle linter setting.'
      item.command = {
        command: 'herb.toggleLinter',
        title: 'Toggle Linter'
      }

      return item
    }

    const totalLintErrors = this.files.reduce((sum, f) => sum + f.lintErrors, 0)
    const totalLintWarnings = this.files.reduce((sum, f) => sum + f.lintWarnings, 0)
    const totalLintInfo = this.files.reduce((sum, f) => sum + f.lintOffenses.filter(o => o.severity === 'info').length, 0)
    const totalLintHints = this.files.reduce((sum, f) => sum + f.lintOffenses.filter(o => o.severity === 'hint').length, 0)
    const filesWithIssues = this.files.filter(f => f.lintOffenses.length > 0).length

    const parts = []

    if (totalLintErrors > 0) {
      parts.push(`${totalLintErrors} error${totalLintErrors === 1 ? '' : 's'}`)
    }

    if (totalLintWarnings > 0) {
      parts.push(`${totalLintWarnings} warning${totalLintWarnings === 1 ? '' : 's'}`)
    }

    if (totalLintInfo > 0) {
      parts.push(`${totalLintInfo} info`)
    }

    if (totalLintHints > 0) {
      parts.push(`${totalLintHints} hint${totalLintHints === 1 ? '' : 's'}`)
    }

    const label = filesWithIssues > 0 ? `Herb Linter (${parts.join(', ')})` : `Herb Linter (${this.files.length} file${this.files.length === 1 ? '' : 's'})`
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)

    if (totalLintErrors > 0) {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else if (totalLintWarnings > 0) {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'))
    } else if (totalLintInfo > 0) {
      item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'))
    } else if (totalLintHints > 0) {
      item.iconPath = new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('charts.gray'))
    } else {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    }

    return item
  }

  private buildLintSeverityGroupItem(element: { severity: LintSeverity }): vscode.TreeItem {
    const count = this.files.filter(f =>
      f.lintOffenses.some(o => o.severity === element.severity)
    ).length

    const label = element.severity === 'error'
      ? `Errors (${count})`
      : element.severity === 'warning'
      ? `Warnings (${count})`
      : element.severity === 'info'
      ? `Info (${count})`
      : `Hints (${count})`

    const collapsibleState = count > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None

    const item = new vscode.TreeItem(label, collapsibleState)

    if (count === 0) {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    } else if (element.severity === 'error') {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else if (element.severity === 'warning') {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
    } else if (element.severity === 'info') {
      item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'))
    } else {
      item.iconPath = new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('charts.gray'))
    }

    return item
  }

  private buildLintRuleGroupItem(element: { rule: string; severity: LintSeverity }): vscode.TreeItem {
    const filesWithRule = this.files.filter(f =>
      f.lintOffenses.some(offense => offense.rule === element.rule && offense.severity === element.severity)
    )

    const label = `${element.rule} (${filesWithRule.length})`
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)

    if (element.rule.startsWith('html-')) {
      item.iconPath = new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.blue'))
    } else if (element.rule.startsWith('erb-')) {
      item.iconPath = new vscode.ThemeIcon('symbol-variable', new vscode.ThemeColor('charts.purple'))
    } else {
      item.iconPath = new vscode.ThemeIcon('symbol-rule', new vscode.ThemeColor('charts.orange'))
    }

    return item
  }

  private buildFolderGroupItem(element: { pathSegments: string[] }): vscode.TreeItem {
    const name = element.pathSegments[element.pathSegments.length - 1]
    return new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.Collapsed)
  }

  private buildPromptItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Analyze Project',
      vscode.TreeItemCollapsibleState.None
    )

    item.command = { command: 'herb.analyzeProject', title: 'Analyze Project' }
    item.iconPath = new vscode.ThemeIcon('play')
    item.tooltip = 'Run project analysis'

    return item
  }

  private buildVersionInfoItem(element: { label: string; value: string }): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${element.label}: ${element.value}`,
      vscode.TreeItemCollapsibleState.None
    )

    item.iconPath = new vscode.ThemeIcon('info')
    item.tooltip = `${element.label}: ${element.value}`

    return item
  }

  private buildSeparatorItem(element: { label: string }): vscode.TreeItem {
    return new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.None
    )
  }

  private buildTimestampItem(element: { label: string; value: string }): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${element.label}: ${element.value}`,
      vscode.TreeItemCollapsibleState.None
    )

    item.iconPath = new vscode.ThemeIcon('clock')
    item.tooltip = `${element.label}: ${element.value}`

    return item
  }

  private buildGitHubRepoItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'GitHub Repo',
      vscode.TreeItemCollapsibleState.None
    )

    item.command = { command: 'vscode.open', title: 'Open GitHub Repo', arguments: [vscode.Uri.parse('https://github.com/marcoroth/herb')] }
    item.iconPath = new vscode.ThemeIcon('github')
    item.tooltip = 'Open the Herb GitHub repository'

    return item
  }

  private buildReportGeneralIssueItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Report Issue',
      vscode.TreeItemCollapsibleState.None
    )

    item.command = { command: 'herb.reportGeneralIssue', title: 'Report General Issue' }
    item.iconPath = new vscode.ThemeIcon('bug')
    item.tooltip = 'Report a general issue with the Herb extension'

    return item
  }

  private buildDocumentationItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      'Documentation',
      vscode.TreeItemCollapsibleState.None
    )

    item.command = { command: 'vscode.open', title: 'Open Documentation', arguments: [vscode.Uri.parse('https://herb-tools.dev')] }
    item.iconPath = new vscode.ThemeIcon('book')
    item.tooltip = 'Open the Herb documentation'

    return item
  }

  private buildNoParseErrorsItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      '🌿 No parse errors, great job!',
      vscode.TreeItemCollapsibleState.None
    )

    item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    item.tooltip = 'All files parsed successfully and have no errors.'

    return item
  }

  private buildParserGroupItem(): vscode.TreeItem {
    const okCount = this.files.filter(f => this.matchesGroup(f, 'ok')).length
    const failCount = this.files.filter(f => f.errors > 0).length
    const timeoutCount = this.files.filter(f => this.matchesGroup(f, 'timeout')).length

    let label = 'Herb Parser'
    if (failCount > 0 || timeoutCount > 0) {
      const parts = []
      if (failCount > 0) {
        parts.push(`${failCount} error${failCount === 1 ? '' : 's'}`)
      }
      if (timeoutCount > 0) {
        parts.push(`${timeoutCount} timeout${timeoutCount === 1 ? '' : 's'}`)
      }
      label = `Herb Parser (${parts.join(', ')})`
    } else {
      label = `Herb Parser (${okCount} file${okCount === 1 ? '' : 's'})`
    }

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded)

    if (failCount > 0) {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else if (timeoutCount > 0) {
      item.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'))
    } else {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    }

    return item
  }

  private buildFormatterIssueGroupItem(): vscode.TreeItem {
    const formatterDisabled = this.files.some(f => f.formatterDisabled)

    if (formatterDisabled) {
      const item = new vscode.TreeItem(
        'Herb Formatter (disabled)',
        vscode.TreeItemCollapsibleState.None
      )

      item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.gray'))
      item.tooltip = 'Formatting is disabled in the Herb configuration (.herb.yml). Click to toggle formatter setting.'
      item.command = {
        command: 'herb.toggleFormatter',
        title: 'Toggle Formatter'
      }

      return item
    }

    const formatterIssueCount = this.files.filter(f => f.formatterIssues).length
    const label = `Herb Formatter (${formatterIssueCount} file${formatterIssueCount === 1 ? '' : 's'})`

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)

    if (formatterIssueCount > 0) {
      item.iconPath = new vscode.ThemeIcon('symbol-color', new vscode.ThemeColor('charts.orange'))
    } else {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    }

    return item
  }

  private buildNoLintIssuesItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      '🌿 No linter issues, great job!',
      vscode.TreeItemCollapsibleState.None
    )

    item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    item.tooltip = 'All files passed linting.'

    return item
  }

  private buildNoFormatterIssuesItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      '🌿 All files are properly formatted, great job!',
      vscode.TreeItemCollapsibleState.None
    )

    item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    item.tooltip = 'All files are properly formatted.'

    return item
  }

  private buildFormatterFileItem(element: FormatterFileNode): vscode.TreeItem {
    return this.buildFileItem(element.file, 'formatter')
  }


  private buildFileItem(element: FileStatus, context?: string): vscode.TreeItem {
    const relativePath = vscode.workspace.asRelativePath(element.uri)
    const fileName = path.basename(relativePath)
    const directory = path.dirname(relativePath)

    const item = new vscode.TreeItem(
      fileName,
      vscode.TreeItemCollapsibleState.None
    )

    item.resourceUri = element.uri

    const hasAnyLintOffenses = element.lintOffenses.length > 0

    if (directory !== '.' && (hasAnyLintOffenses || element.formatterIssues)) {
      item.description = `(${directory})`
    } else {
      if (context === 'formatter' && element.formatterIssues) {
        item.description = 'needs formatting'
      } else {
        item.description =
          element.status === 'processing'
            ? 'Processing'
            : element.status === 'ok'
            ? 'OK'
            : element.status === 'timeout'
            ? 'Timeout'
            : this.buildFileDescription(element)
      }
    }

    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [element.uri]
    }

    const hasIssues = element.errors > 0 || hasAnyLintOffenses || element.status === 'failed' || element.status === 'timeout'
    const hasOnlyInfoOrHints = hasAnyLintOffenses && element.lintErrors === 0 && element.lintWarnings === 0

    item.contextValue = hasIssues ? (hasOnlyInfoOrHints ? 'herbFileWithMinorIssues' : 'herbFileWithIssues') : 'herbFileOk'

    return item
  }

  private buildFileDescription(element: FileStatus): string {
    const parts: string[] = []

    if (element.errors > 0) {
      parts.push(`${element.errors} parse error${element.errors === 1 ? '' : 's'}`)
    }

    if (element.lintErrors > 0) {
      parts.push(`${element.lintErrors} lint error${element.lintErrors === 1 ? '' : 's'}`)
    }

    if (element.lintWarnings > 0) {
      parts.push(`${element.lintWarnings} warning${element.lintWarnings === 1 ? '' : 's'}`)
    }

    const lintInfo = element.lintOffenses.filter(o => o.severity === 'info').length
    const lintHints = element.lintOffenses.filter(o => o.severity === 'hint').length

    if (lintInfo > 0) {
      parts.push(`${lintInfo} info`)
    }

    if (lintHints > 0) {
      parts.push(`${lintHints} hint${lintHints === 1 ? '' : 's'}`)
    }

    if (element.formatterIssues) {
      parts.push('needs formatting')
    }

    return parts.join(', ')
  }

  private matchesGroup(file: FileStatus, status: Status): boolean {
    switch (status) {
      case 'processing': return file.status === 'processing'
      case 'timeout': return file.status === 'timeout'
      case 'failed': return file.status === 'failed' && (file.errors > 0 || file.lintErrors > 0)
      case 'ok': return file.status === 'ok' && file.errors === 0 && file.lintErrors === 0 && file.lintWarnings === 0 && file.lintOffenses.length === 0
      case 'formatter': return file.formatterIssues === true
    }
  }
}
