import { TreeItemBuilder } from './tree-item-builder'
import { TreeChildrenProvider } from './tree-children-provider'
import { AnalysisService } from './analysis-service'
import { VersionService } from './version-service'

import { workspace, window, commands, EventEmitter, ProgressLocation } from 'vscode'

import { Config } from "@herb-tools/config"

import type { FileStatus, TreeNode } from './types'
import type { TreeDataProvider, Event, ExtensionContext, TreeItem, Uri } from 'vscode'

export class HerbAnalysisProvider implements TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: EventEmitter<TreeNode | undefined | void> = new EventEmitter()
  readonly onDidChangeTreeData: Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event

  private files: FileStatus[] = []
  private lastAnalysisTime: Date | null = null

  private treeItemBuilder!: TreeItemBuilder
  private treeChildrenProvider!: TreeChildrenProvider
  private analysisService: AnalysisService
  private versionService: VersionService
  private onAnalysisTimeUpdate?: (time: Date | null) => void
  private onVersionUpdate?: () => void

  constructor(context: ExtensionContext, onAnalysisTimeUpdate?: (time: Date | null) => void, onVersionUpdate?: () => void) {
    this.onAnalysisTimeUpdate = onAnalysisTimeUpdate
    this.onVersionUpdate = onVersionUpdate
    this.versionService = new VersionService(context)
    this.analysisService = new AnalysisService(context, (version) => this.updateHerbVersions(version))
    this.updateProviders()
  }

  private updateProviders(): void {
    this.treeItemBuilder = new TreeItemBuilder(this.files)
    this.treeChildrenProvider = new TreeChildrenProvider(this.files)
  }

  getTreeItem(element: TreeNode): TreeItem {
    return this.treeItemBuilder.buildTreeItem(element)
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    return Promise.resolve(this.treeChildrenProvider.getChildren(element))
  }

  async analyzeProject(): Promise<void> {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath

    let includePattern: string
    let excludePattern: string | undefined

    if (workspaceRoot) {
      try {
        const config = await Config.loadForEditor(workspaceRoot)

        const linterFiles = config.getFilesConfigForTool('linter')
        const formatterFiles = config.getFilesConfigForTool('formatter')

        const allIncludePatterns = [...new Set([...(linterFiles.include || []), ...(formatterFiles.include || [])])]

        if (allIncludePatterns.length > 0) {
          includePattern = allIncludePatterns.length === 1 ? allIncludePatterns[0] : `{${allIncludePatterns.join(',')}}`
        } else {
          const patterns = Config.getDefaultFilePatterns()
          includePattern = patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`
        }

        const linterExclude = linterFiles.exclude || []
        const formatterExclude = formatterFiles.exclude || []
        const commonExclude = linterExclude.filter(pattern => formatterExclude.includes(pattern))

        if (commonExclude.length > 0) {
          excludePattern = `{${commonExclude.join(',')}}`
        }
      } catch (_error) {
        window.showErrorMessage(
          'Cannot run Herb analysis: Configuration file has errors. Please fix .herb.yml and try again.',
          'Edit Config'
        ).then(selection => {
          if (selection === 'Edit Config') {
            commands.executeCommand('herb.editConfig')
          }
        })

        return
      }
    } else {
      includePattern = Config.getDefaultFilePatterns().join(",")
    }

    const uris = await workspace.findFiles(includePattern, excludePattern)

    this.lastAnalysisTime = new Date()

    this.files = uris.map(uri => ({
      uri,
      status: 'processing',
      errors: 0,
      lintWarnings: 0,
      lintErrors: 0,
      lintOffenses: [],
      linterDisabled: false
    }))

    this.updateProviders()
    this._onDidChangeTreeData.fire()

    if (this.onAnalysisTimeUpdate) {
      this.onAnalysisTimeUpdate(this.lastAnalysisTime)
    }

    await window.withProgress(
      {
        location: ProgressLocation.Window,
        title: 'Herb: Analyzing files...',
        cancellable: false
      },
      async progress => {
        this.files = await this.analysisService.analyzeProject(this.files, (current, total) => {
          progress.report({ message: `${current}/${total} files` })
          this.updateProviders()
          this._onDidChangeTreeData.fire()
        })

        this.updateProviders()
        this._onDidChangeTreeData.fire()

        const summary = this.analysisService.generateSummary(this.files)
        const message = `Herb analyzed ${this.files.length} files. ${summary}`

        const totalParseErrors = this.files.reduce((sum, file) => sum + file.errors, 0)
        const totalLintErrors = this.files.reduce((sum, file) => sum + file.lintErrors, 0)
        const totalLintWarnings = this.files.reduce((sum, file) => sum + file.lintWarnings, 0)

        if (totalParseErrors > 0 || totalLintErrors > 0) {
          window.showErrorMessage(message, 'View Details').then(selection => {
            if (selection === 'View Details') {
              commands.executeCommand('herbFileStatus.focus')
            }
          })
        } else if (totalLintWarnings > 0) {
          window.showWarningMessage(message, 'View Details').then(selection => {
            if (selection === 'View Details') {
              commands.executeCommand('herbFileStatus.focus')
            }
          })
        } else {
          window.showInformationMessage(message, 'View Details').then(selection => {
            if (selection === 'View Details') {
              commands.executeCommand('herbFileStatus.focus')
            }
          })
        }
      }
    )
  }

  async reprocessFile(uri: Uri): Promise<void> {
    const index = this.files.findIndex(file => file.uri.toString() === uri.toString())

    if (index >= 0) {
      const result = await this.analysisService.analyzeFile(uri.fsPath)
      const updated: FileStatus = { uri, ...result }
      this.files[index] = updated

      this.updateProviders()
      this._onDidChangeTreeData.fire()
    }
  }

  async removeFile(uri: Uri): Promise<void> {
    const index = this.files.findIndex(file => file.uri.toString() === uri.toString())

    if (index >= 0) {
      this.files.splice(index, 1)
      this.updateProviders()
      this._onDidChangeTreeData.fire()
    }
  }

  updateHerbVersions(versionString: string): void {
    if (versionString !== this.versionService.herbVersions) {
      this.versionService.updateHerbVersions(versionString)
      this.updateProviders()
      this._onDidChangeTreeData.fire()

      if (this.onVersionUpdate) {
        this.onVersionUpdate()
      }
    }
  }

  clearAnalysis(): void {
    this.files = []
    this.lastAnalysisTime = null
    this.updateProviders()
    this._onDidChangeTreeData.fire()

    if (this.onAnalysisTimeUpdate) {
      this.onAnalysisTimeUpdate(null)
    }
  }
}
