import * as vscode from 'vscode'
import * as path from 'path'
import type { FileStatus, TreeNode, Status } from './types'

export class TreeItemBuilder {
  constructor(private files: FileStatus[]) {}

  buildTreeItem(element: TreeNode): vscode.TreeItem {
    if ('type' in element) {
      switch (element.type) {
        case 'statusGroup':
          return this.buildStatusGroupItem(element)
        case 'parseErrorGroup':
          return this.buildParseErrorGroupItem()
        case 'lintIssueGroup':
          return this.buildLintIssueGroupItem()
        case 'lintSeverityGroup':
          return this.buildLintSeverityGroupItem(element)
        case 'lintRuleGroup':
          return this.buildLintRuleGroupItem(element)
        case 'folderGroup':
          return this.buildFolderGroupItem(element)
        case 'prompt':
          return this.buildPromptItem()
        case 'versionInfo':
          return this.buildVersionInfoItem(element)
        case 'separator':
          return this.buildSeparatorItem(element)
        case 'timestamp':
          return this.buildTimestampItem(element)
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
        ? `Processing (${processingCount})`
        : element.status === 'ok'
        ? `Successful (${okCount})`
        : element.status === 'timeout'
        ? `Timed Out (${timeoutCount})`
        : `Failed (${failCount})`

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)
    
    if (element.status === 'ok') {
      item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
    } else if (element.status === 'failed') {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else if (element.status === 'timeout') {
      item.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'))
    } else if (element.status === 'processing') {
      item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'))
    }
    
    return item
  }

  private buildParseErrorGroupItem(): vscode.TreeItem {
    const parseErrorCount = this.files.filter(f => f.errors > 0).length
    const label = `Parse Errors (${parseErrorCount})`
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)
    item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    return item
  }

  private buildLintIssueGroupItem(): vscode.TreeItem {
    const linterDisabled = this.files.some(f => f.linterDisabled)
    
    if (linterDisabled) {
      const label = 'Linter Issues (Disabled)'
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
      item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('charts.gray'))
      item.tooltip = 'Linting is disabled in VS Code settings. Click to open settings.'
      item.command = {
        command: 'workbench.action.openSettings',
        title: 'Open Settings',
        arguments: ['languageServerHerb.linter.enabled']
      }
      return item
    }
    
    const lintErrorCount = this.files.filter(f => f.lintErrors > 0).length
    const lintWarningCount = this.files.filter(f => f.lintWarnings > 0).length
    const totalLintIssues = this.files.filter(f => f.lintErrors > 0 || f.lintWarnings > 0).length
    
    const parts = []
    if (lintErrorCount > 0) {
      parts.push(`${lintErrorCount} errors`)
    }
    if (lintWarningCount > 0) {
      parts.push(`${lintWarningCount} warnings`)
    }
    
    const label = `Linter Issues (${totalLintIssues} files with ${parts.join(', ')})`
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)
    item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'))
    return item
  }

  private buildLintSeverityGroupItem(element: { severity: 'error' | 'warning' }): vscode.TreeItem {
    const count = element.severity === 'error' 
      ? this.files.filter(f => f.lintErrors > 0).length
      : this.files.filter(f => f.lintWarnings > 0).length
    
    const label = element.severity === 'error' ? `Errors (${count})` : `Warnings (${count})`
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)
    
    if (element.severity === 'error') {
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
    } else {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
    }
    
    return item
  }

  private buildLintRuleGroupItem(element: { rule: string; severity: 'error' | 'warning' }): vscode.TreeItem {
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

  private buildFileItem(element: FileStatus): vscode.TreeItem {
    const relativePath = vscode.workspace.asRelativePath(element.uri)
    const fileName = path.basename(relativePath)
    const directory = path.dirname(relativePath)

    const item = new vscode.TreeItem(
      fileName,
      vscode.TreeItemCollapsibleState.None
    )

    item.resourceUri = element.uri
    
    if (directory !== '.' && (element.lintErrors > 0 || element.lintWarnings > 0)) {
      item.description = `(${directory})`
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

    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [element.uri]
    }

    item.contextValue = 'herbFile'
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
    
    return parts.join(', ')
  }

  private matchesGroup(file: FileStatus, status: Status): boolean {
    switch (status) {
      case 'processing': return file.status === 'processing'
      case 'timeout': return file.status === 'timeout'
      case 'failed': return file.status === 'failed' && (file.errors > 0 || file.lintErrors > 0)
      case 'ok': return file.status === 'ok' && file.errors === 0 && file.lintErrors === 0
    }
  }
}