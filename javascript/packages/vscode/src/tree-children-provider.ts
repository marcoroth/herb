import * as vscode from 'vscode'
import * as path from 'path'
import type { LintSeverity, LinterRule } from '@herb-tools/linter'
import type { FileStatus, TreeNode, Status, FolderGroup, FormatterFileNode } from './types'

export class TreeChildrenProvider {
  constructor(
    private files: FileStatus[]
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
          if (element.status === 'failed') {
            return this.buildParseErrorFolderTree(element.pathSegments)
          } else if (element.status === 'formatter') {
            return this.buildFormatterIssueFolderTree(element.pathSegments)
          } else {
            return this.buildFolderTree(element.status, element.pathSegments)
          }

        case 'parseErrorGroup':
          const parseErrorCount = this.files.filter(f => f.errors > 0).length

          return parseErrorCount > 0 ? this.buildParseErrorFolderTree([]) : []

        case 'lintIssueGroup':
          const lintIssueCount = this.files.filter(f => f.lintOffenses.length > 0).length
          const linterDisabled = this.files.some(f => f.linterDisabled)

          if (linterDisabled) {
            return []
          } else if (lintIssueCount > 0) {
            return this.getLintSeverityGroups()
          } else {
            return [{ type: 'noLintIssues' }]
          }

        case 'lintSeverityGroup':
          return this.getLintRuleGroups(element.severity)

        case 'lintRuleGroup':
          return this.getFilesWithLintRule(element.rule, element.severity)

        case 'parserGroup':
          return [
            { type: 'statusGroup', status: 'ok' },
            { type: 'parseErrorGroup' },
            { type: 'statusGroup', status: 'timeout' }
          ]

        case 'formatterIssueGroup':
          const formatterIssueCount = this.files.filter(f => f.formatterIssues).length
          const formatterDisabled = this.files.some(f => f.formatterDisabled)

          if (formatterDisabled) {
            return []
          } else if (formatterIssueCount > 0) {
            return this.buildFormatterIssueFolderTree([])
          } else {
            return [{ type: 'noFormatterIssues' }]
          }
      }
    }

    return []
  }

  private getRootChildren(): TreeNode[] {
    if (this.files.length === 0) {
      return [{ type: 'prompt' }]
    }

    const processingCount = this.files.filter(f => f.status === 'processing').length

    const groups: TreeNode[] = []

    if (processingCount > 0) {
      groups.push({ type: 'statusGroup', status: 'processing' })
    } else {
      groups.push({ type: 'parserGroup' })
      groups.push({ type: 'lintIssueGroup' })

      const formatterIssueCount = this.files.filter(f => f.formatterIssues).length
      const formatterDisabled = this.files.some(f => f.formatterDisabled)
      if (formatterIssueCount > 0 || formatterDisabled) {
        groups.push({ type: 'formatterIssueGroup' })
      }
    }

    return groups
  }

  private getLintSeverityGroups(): TreeNode[] {
    return [
      { type: 'lintSeverityGroup', severity: 'error' },
      { type: 'lintSeverityGroup', severity: 'warning' },
      { type: 'lintSeverityGroup', severity: 'info' },
      { type: 'lintSeverityGroup', severity: 'hint' }
    ]
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

  private buildFormatterIssueFolderTree(pathSegments: string[]): (FolderGroup | FormatterFileNode)[] {
    const map = new Map<string, { hasSubdir: boolean; files: FileStatus[] }>()

    for (const file of this.files) {
      if (!file.formatterIssues) {
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
    const nodes: (FolderGroup | FormatterFileNode)[] = []

    for (const key of keys) {
      const entry = map.get(key)!
      const childPath = [...pathSegments, key]

      if (entry.hasSubdir) {
        nodes.push({ type: 'folderGroup', status: 'formatter', pathSegments: childPath })
      }

      if (!entry.hasSubdir) {
        for (const file of entry.files) {
          nodes.push({ type: 'formatterFile', file })
        }
      }
    }

    return nodes
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
      case 'formatter': return file.formatterIssues === true
    }
  }

}
