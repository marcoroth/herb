import * as vscode from "vscode"
import { VersionService } from "./version-service"
import { TreeItemBuilder } from "./tree-item-builder"
import type { TreeNode } from "./types"

export class HerbInformationProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | void> = new vscode.EventEmitter()
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event

  private versionService: VersionService
  private treeItemBuilder: TreeItemBuilder
  private lastAnalysisTime: Date | null = null

  constructor(context: vscode.ExtensionContext) {
    this.versionService = new VersionService(context)
    this.treeItemBuilder = new TreeItemBuilder([])
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return this.treeItemBuilder.buildTreeItem(element)
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (element) {
      return Promise.resolve([])
    }

    return Promise.resolve(this.getInformationNodes())
  }

  updateLastAnalysisTime(time: Date | null): void {
    this.lastAnalysisTime = time
    this._onDidChangeTreeData.fire()
  }

  updateVersions(): void {
    this._onDidChangeTreeData.fire()
  }

  private getInformationNodes(): TreeNode[] {
    const nodes: TreeNode[] = []

    if (this.lastAnalysisTime) {
      const timeString = this.lastAnalysisTime.toLocaleString()
      nodes.push({ type: 'timestamp', label: 'Last run', value: timeString })
    }

    nodes.push({ type: 'versionInfo', label: 'VS Code Extension', value: `v${this.versionService.extensionVersion}` })
    nodes.push({ type: 'versionInfo', label: '@herb-tools/linter', value: `v${this.versionService.linterVersion}` })

    const herbComponents = this.versionService.parseHerbVersion()

    herbComponents.forEach(component => {
      nodes.push({ type: 'versionInfo', label: component.name, value: component.version })
    })

    return nodes
  }
}
