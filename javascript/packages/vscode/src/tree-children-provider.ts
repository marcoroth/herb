import * as vscode from 'vscode'
import * as path from 'path'
import type { LintSeverity, LinterRule } from '@herb-tools/linter'
import type { FileStatus, TreeNode, Status, FolderGroup } from './types'
import type { VersionComponent } from './version-service'

export class TreeChildrenProvider {
  constructor(
    private files: FileStatus[],
    private lastAnalysisTime: Date | null,
    private getVersionComponents: () => VersionComponent[],
    private extensionVersion: string,
    private linterVersion: string
  ) {}

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.getRootChildren()
    }

    if ('type' in element) {
      switch (element.type) {
        case 'statusGroup':
          if (element.status === 'ok') {
            return []
          }

          if (element.status === 'timeout') {
            const timeoutFiles = this.files.filter(f => f.status === 'timeout')

            return timeoutFiles.length === 0 ? [] : this.buildFolderTree(element.status, [])
          }

          return this.buildFolderTree(element.status, [])

        case 'folderGroup':
          return element.status === 'failed'
            ? this.buildParseErrorFolderTree(element.pathSegments)
            : this.buildFolderTree(element.status, element.pathSegments)

        case 'parseErrorGroup':
          const parseErrorCount = this.files.filter(f => f.errors > 0).length

          return parseErrorCount > 0 ? this.buildParseErrorFolderTree([]) : [{ type: 'noParseErrors' }]

        case 'lintIssueGroup':
          const lintIssueCount = this.files.filter(f => f.lintErrors > 0 || f.lintWarnings > 0).length
          const linterDisabled = this.files.some(f => f.linterDisabled)

          if (lintIssueCount > 0 || linterDisabled) {
            return this.getLintSeverityGroups()
          } else {
            return [{ type: 'noLintIssues' }]
          }

        case 'lintSeverityGroup':
          return this.getLintRuleGroups(element.severity)

        case 'lintRuleGroup':
          return this.getFilesWithLintRule(element.rule, element.severity)
      }
    }

    return []
  }

  private getRootChildren(): TreeNode[] {
    if (this.files.length === 0) {
      const infoNodes = this.createInfoNodes()
      return [{ type: 'prompt' }, ...infoNodes]
    }

    const processingCount = this.files.filter(f => f.status === 'processing').length

    const groups: TreeNode[] = []
    groups.push({ type: 'separator', label: '── Analysis Results ──' })

    if (processingCount > 0) {
      groups.push({ type: 'statusGroup', status: 'processing' })
    } else {
      groups.push({ type: 'statusGroup', status: 'ok' })

      // Always show parse error group (will contain "great job" message if no errors)
      groups.push({ type: 'parseErrorGroup' })

      // Always show linter issue group (will contain "great job" message if no issues)
      groups.push({ type: 'lintIssueGroup' })

      groups.push({ type: 'statusGroup', status: 'timeout' })
    }

    const infoNodes = this.createInfoNodes()
    groups.push(...infoNodes)
    return groups
  }

  private getLintSeverityGroups(): TreeNode[] {
    const groups: TreeNode[] = []

    const filesWithErrors = this.files.filter(f => f.lintErrors > 0)
    if (filesWithErrors.length > 0) {
      groups.push({ type: 'lintSeverityGroup', severity: 'error' })
    }

    const filesWithWarnings = this.files.filter(f => f.lintWarnings > 0)
    if (filesWithWarnings.length > 0) {
      groups.push({ type: 'lintSeverityGroup', severity: 'warning' })
    }

    return groups
  }

  private getLintRuleGroups(severity: LintSeverity): TreeNode[] {
    const rules = this.getLintRulesForSeverity(severity)
    return rules.map(rule => ({
      type: 'lintRuleGroup' as const,
      rule,
      severity
    }))
  }

  private getLintRulesForSeverity(severity: LintSeverity): LinterRule[] {
    const rules = new Set<LinterRule>()

    for (const file of this.files) {
      for (const offense of file.lintOffenses) {
        if (offense.severity === severity) {
          rules.add(offense.rule)
        }
      }
    }

    return Array.from(rules).sort()
  }

  private getFilesWithLintRule(rule: LinterRule, severity: LintSeverity): FileStatus[] {
    return this.files.filter(f =>
      f.lintOffenses.some(offense => offense.rule === rule && offense.severity === severity)
    )
  }

  private buildParseErrorFolderTree(pathSegments: string[]): (FolderGroup | FileStatus)[] {
    const map = new Map<string, { hasSubdir: boolean; files: FileStatus[] }>()

    for (const file of this.files) {
      if (file.errors === 0) {
        continue
      }

      const relativePath = vscode.workspace.asRelativePath(file.uri)
      const segments = relativePath.split(path.sep)

      if (
        pathSegments.length > segments.length ||
        segments.slice(0, pathSegments.length).join() !== pathSegments.join()
      ) {
        continue
      }

      const rest = segments.slice(pathSegments.length)
      const key = rest[0]
      const entry = map.get(key) || { hasSubdir: false, files: [] }

      if (rest.length === 1) {
        entry.files.push(file)
      } else {
        entry.hasSubdir = true
      }

      map.set(key, entry)
    }

    const keys = Array.from(map.keys()).sort()
    const nodes: (FolderGroup | FileStatus)[] = []

    for (const key of keys) {
      const entry = map.get(key)!
      const childPath = [...pathSegments, key]

      if (entry.hasSubdir) {
        nodes.push({ type: 'folderGroup', status: 'failed', pathSegments: childPath })
      }

      if (!entry.hasSubdir) {
        for (const file of entry.files) {
          nodes.push(file)
        }
      }
    }

    return nodes
  }

  private buildFolderTree(status: Status, pathSegments: string[]): (FolderGroup | FileStatus)[] {
    const map = new Map<string, { hasSubdir: boolean; files: FileStatus[] }>()

    for (const file of this.files) {
      if (!this.matchesGroup(file, status)) {
        continue
      }

      const relativePath = vscode.workspace.asRelativePath(file.uri)
      const segments = relativePath.split(path.sep)

      if (
        pathSegments.length > segments.length ||
        segments.slice(0, pathSegments.length).join() !== pathSegments.join()
      ) {
        continue
      }

      const rest = segments.slice(pathSegments.length)
      const key = rest[0]
      const entry = map.get(key) || { hasSubdir: false, files: [] }

      if (rest.length === 1) {
        entry.files.push(file)
      } else {
        entry.hasSubdir = true
      }

      map.set(key, entry)
    }

    const keys = Array.from(map.keys()).sort()
    const nodes: (FolderGroup | FileStatus)[] = []

    for (const key of keys) {
      const entry = map.get(key)!
      const childPath = [...pathSegments, key]

      if (entry.hasSubdir) {
        nodes.push({ type: 'folderGroup', status, pathSegments: childPath })
      }

      if (!entry.hasSubdir) {
        for (const file of entry.files) {
          nodes.push(file)
        }
      }
    }

    return nodes
  }

  private matchesGroup(file: FileStatus, status: Status): boolean {
    switch (status) {
      case 'processing': return file.status === 'processing'
      case 'timeout': return file.status === 'timeout'
      case 'failed': return file.status === 'failed' && (file.errors > 0 || file.lintErrors > 0)
      case 'ok': return file.status === 'ok' && file.errors === 0 && file.lintErrors === 0
    }
  }

  private createInfoNodes(): TreeNode[] {
    const nodes: TreeNode[] = []

    nodes.push({ type: 'separator', label: '' })
    nodes.push({ type: 'separator', label: '' })
    nodes.push({ type: 'separator', label: '── Information ──' })

    if (this.lastAnalysisTime) {
      const timeString = this.lastAnalysisTime.toLocaleString()
      nodes.push({ type: 'timestamp', label: 'Last run', value: timeString })
    }

    nodes.push({ type: 'versionInfo', label: 'VS Code Extension', value: `v${this.extensionVersion}` })
    nodes.push({ type: 'versionInfo', label: '@herb-tools/linter', value: `v${this.linterVersion}` })

    const herbComponents = this.getVersionComponents()
    herbComponents.forEach(component => {
      nodes.push({ type: 'versionInfo', label: component.name, value: component.version })
    })

    nodes.push({ type: 'separator', label: '' })
    nodes.push({ type: 'separator', label: '' })
    nodes.push({ type: 'separator', label: '── Support ──' })
    nodes.push({ type: 'githubRepo' })
    nodes.push({ type: 'reportGeneralIssue' })
    nodes.push({ type: 'documentation' })

    return nodes
  }
}
