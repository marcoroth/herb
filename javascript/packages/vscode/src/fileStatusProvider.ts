import * as vscode from 'vscode'
import * as path from 'path'

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

type Status = 'processing' | 'ok' | 'failed' | 'timeout'

export interface FileStatus {
  uri: vscode.Uri
  status: Status
  errors: number
}

interface StatusGroup {
  type: 'statusGroup'
  status: Status
}

interface FolderGroup {
  type: 'folderGroup'
  status: Status
  pathSegments: string[]
}

interface PromptNode {
  type: 'prompt'
}

type TreeNode = StatusGroup | FolderGroup | FileStatus | PromptNode

export class HerbFileStatusProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | void> = new vscode.EventEmitter()
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event

  private files: FileStatus[] = []
  private workerPath: string

  constructor(private context: vscode.ExtensionContext) {
    this.workerPath = context.asAbsolutePath(path.join('dist', 'parse-worker.js'))
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if ('type' in element && element.type === 'statusGroup') {
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

      return new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed)
    }

    if ('type' in element && element.type === 'folderGroup') {
      const name = element.pathSegments[element.pathSegments.length - 1]

      return new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    if ('type' in element && element.type === 'prompt') {
      const item = new vscode.TreeItem(
        'Run Herb: Analyze Project',
        vscode.TreeItemCollapsibleState.None
      )

      item.command = {
        command: 'herb.analyzeProject',
        title: 'Analyze Project'
      }

      return item
    }

    // FileStatus leaf (including 'processing')
    const relativePath = vscode.workspace.asRelativePath(element.uri)

    const item = new vscode.TreeItem(
      path.basename(relativePath),
      vscode.TreeItemCollapsibleState.None
    )

    item.resourceUri = element.uri
    item.description =
      element.status === 'processing'
        ? 'Processing'
        : element.status === 'ok'
        ? 'OK'
        : element.status === 'timeout'
        ? 'Timeout'
        : `${element.errors} errors`

    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [element.uri]
    }

    item.contextValue = 'herbFile'

    return item
  }

  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      if (this.files.length === 0) {
        return Promise.resolve([{ type: 'prompt' }])
      }

      const okCount = this.files.filter(f => f.status !== 'processing' && f.status !== 'timeout' && f.errors === 0).length
      const failedCount = this.files.filter(f => f.status !== 'processing' && f.status !== 'timeout' && f.errors > 0).length
      const timeoutCount = this.files.filter(f => f.status === 'timeout').length
      const processingCount = this.files.filter(f => f.status === 'processing').length

      const groups: StatusGroup[] = []

      if (okCount > 0) groups.push({ type: 'statusGroup', status: 'ok' })
      if (failedCount > 0) groups.push({ type: 'statusGroup', status: 'failed' })
      if (timeoutCount > 0) groups.push({ type: 'statusGroup', status: 'timeout' })
      if (processingCount > 0) groups.push({ type: 'statusGroup', status: 'processing' })

      return Promise.resolve(groups)
    }

    if ('type' in element && element.type === 'statusGroup') {
      return Promise.resolve(
        this.buildFolderTree(element.status, [])
      )
    }

    if ('type' in element && element.type === 'folderGroup') {
      return Promise.resolve(
        this.buildFolderTree(element.status, element.pathSegments)
      )
    }

    // FileStatus leaf
    return Promise.resolve([])
  }

  /**
   * Returns true if the file belongs in the given status group.
   */
  private matchesGroup(file: FileStatus, status: Status): boolean {
    switch (status) {
      case 'processing': return file.status === 'processing'
      case 'timeout': return file.status === 'timeout'
      case 'failed': return file.errors > 0
      case 'ok': return file.status !== 'processing' && file.status !== 'timeout' && file.errors === 0
    }
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
        segments.slice(0, pathSegments.length).join() !==
          pathSegments.join()
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

  async analyzeProject() {
    const uris = await vscode.workspace.findFiles('**/*.html.erb')

    // Initialize all files as 'processing'
    this.files = uris.map(uri => ({ uri, status: 'processing', errors: 0 }))
    this._onDidChangeTreeData.fire()

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Herb: Analyzing files...',
        cancellable: false
      },
      async progress => {
        const total = uris.length
        let done = 0

        // Throttle parallel parsing based on CPU cores
        const cpus = Math.max(1, require('os').cpus().length)
        const queue = uris.slice()
        const workers: Promise<void>[] = Array(cpus)
          .fill(undefined)
          .map(async () => {
            while (queue.length) {
              const uri = queue.shift()!
              const { status, errors } = await this.parseFile(uri.fsPath)
              // update that file's status
              const index = this.files.findIndex(file => file.uri.toString() === uri.toString())

              if (index >= 0) {
                this.files[index].status = status
                this.files[index].errors = errors
              }

              await vscode.workspace.openTextDocument(uri)

              done++
              progress.report({ message: `${done}/${total} files` })
              this._onDidChangeTreeData.fire()
            }
          })

        await Promise.all(workers)

        const totalErrors = this.files.reduce((sum, file) => sum + file.errors, 0)

        vscode.window.showInformationMessage(
          `Herb analyzed ${total} files. Errors: ${totalErrors}`
        )
      }
    )
  }

  /**
   * Reparse a single file and update the tree.
   */
  async reprocessFile(uri: vscode.Uri): Promise<void> {
    const status = await this.parseFile(uri.fsPath)
    const idx = this.files.findIndex(f => f.uri.toString() === uri.toString())
    const updated: FileStatus = { uri, ...status }

    if (idx >= 0) {
      this.files[idx] = updated
    } else {
      this.files.push(updated)
    }

    this._onDidChangeTreeData.fire()
  }

  private async parseFile(file: string): Promise<{ status: Status; errors: number }> {
    try {
      const { stdout } = await execFileAsync(process.execPath, [this.workerPath, file], { timeout: 1000 })
      const result = JSON.parse(stdout.trim())
      const failed = result.errors > 0

      return { status: failed ? 'failed' : 'ok', errors: result.errors }
    } catch (error: any) {
      if (error.killed) {
        return { status: 'timeout', errors: 0 }
      }

      // Treat any parse exception as at least one error
      return { status: 'failed', errors: 1 }
    }
  }
}
