import { TreeItemBuilder } from './tree-item-builder'
import { TreeChildrenProvider } from './tree-children-provider'
import { AnalysisService } from './analysis-service'
import { VersionService } from './version-service'

import { workspace, window, EventEmitter, ProgressLocation } from 'vscode'

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

  constructor(context: ExtensionContext) {
    this.versionService = new VersionService(context)
    this.analysisService = new AnalysisService(context, (version) => this.updateHerbVersions(version))
    this.updateProviders()
  }

  private updateProviders(): void {
    this.treeItemBuilder = new TreeItemBuilder(this.files)
    this.treeChildrenProvider = new TreeChildrenProvider(
      this.files,
      this.lastAnalysisTime,
      () => this.versionService.parseHerbVersion(),
      this.versionService.extensionVersion,
      this.versionService.linterVersion
    )
  }

  getTreeItem(element: TreeNode): TreeItem {
    return this.treeItemBuilder.buildTreeItem(element)
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    return Promise.resolve(this.treeChildrenProvider.getChildren(element))
  }

  async analyzeProject(): Promise<void> {
    const uris = await workspace.findFiles('**/*.html.erb')

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
          window.showErrorMessage(message)
        } else if (totalLintWarnings > 0) {
          window.showWarningMessage(message)
        } else {
          window.showInformationMessage(message)
        }
      }
    )
  }

  async reprocessFile(uri: Uri): Promise<void> {
    const result = await this.analysisService.analyzeFile(uri.fsPath)
    const idx = this.files.findIndex(f => f.uri.toString() === uri.toString())
    const updated: FileStatus = { uri, ...result }

    if (idx >= 0) {
      this.files[idx] = updated
    } else {
      this.files.push(updated)
    }

    this.updateProviders()
    this._onDidChangeTreeData.fire()
  }

  updateHerbVersions(versionString: string): void {
    if (versionString !== this.versionService.herbVersions) {
      this.versionService.updateHerbVersions(versionString)
      this.updateProviders()
      this._onDidChangeTreeData.fire()
    }
  }
}
