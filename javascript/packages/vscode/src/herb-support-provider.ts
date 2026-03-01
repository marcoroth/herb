import * as vscode from "vscode"
import { TreeItemBuilder } from "./tree-item-builder"
import type { TreeNode } from "./types"

export class HerbSupportProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | void> = new vscode.EventEmitter()
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event

  private treeItemBuilder: TreeItemBuilder

  constructor() {
    this.treeItemBuilder = new TreeItemBuilder([])
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return this.treeItemBuilder.buildTreeItem(element)
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (element) {
      return Promise.resolve([])
    }

    return Promise.resolve(this.getSupportNodes())
  }

  private getSupportNodes(): TreeNode[] {
    return [
      { type: 'githubRepo' },
      { type: 'reportGeneralIssue' },
      { type: 'documentation' }
    ]
  }
}