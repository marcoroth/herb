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

interface VersionInfoNode {
  type: 'versionInfo'
  label: string
  value: string
}

interface SeparatorNode {
  type: 'separator'
  label: string
}

interface TimestampNode {
  type: 'timestamp'
  label: string
  value: string
}

type TreeNode = StatusGroup | FolderGroup | FileStatus | PromptNode | VersionInfoNode | SeparatorNode | TimestampNode

export class HerbFileStatusProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | void> = new vscode.EventEmitter()
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event

  private files: FileStatus[] = []
  private workerPath: string
  private extensionVersion: string
  private herbVersions: string
  private lastAnalysisTime: Date | null = null

  constructor(private context: vscode.ExtensionContext) {
    this.workerPath = context.asAbsolutePath(path.join('dist', 'parse-worker.js'))
    
    const packageJson = require(context.asAbsolutePath('package.json'))
    this.extensionVersion = packageJson.version
    this.herbVersions = 'Not analyzed yet'
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

    if ('type' in element && element.type === 'folderGroup') {
      const name = element.pathSegments[element.pathSegments.length - 1]

      return new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.Collapsed)
    }

    
    if ('type' in element && element.type === 'prompt') {
      const item = new vscode.TreeItem(
        'Analyze Project',
        vscode.TreeItemCollapsibleState.None
      )
      item.command = { command: 'herb.analyzeProject', title: 'Analyze Project' }
      item.iconPath = new vscode.ThemeIcon('play')
      item.tooltip = 'Run project analysis'
      return item
    }

    if ('type' in element && element.type === 'versionInfo') {
      const item = new vscode.TreeItem(
        `${element.label}: ${element.value}`,
        vscode.TreeItemCollapsibleState.None
      )
      item.iconPath = new vscode.ThemeIcon('info')
      item.tooltip = `${element.label}: ${element.value}`
      return item
    }

    if ('type' in element && element.type === 'separator') {
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.None
      )
      return item
    }

    if ('type' in element && element.type === 'timestamp') {
      const item = new vscode.TreeItem(
        `${element.label}: ${element.value}`,
        vscode.TreeItemCollapsibleState.None
      )
      item.iconPath = new vscode.ThemeIcon('clock')
      item.tooltip = `${element.label}: ${element.value}`
      return item
    }

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
        const infoNodes = this.createInfoNodes()
        return Promise.resolve([{ type: 'prompt' }, ...infoNodes])
      }

      const okCount = this.files.filter(f => this.matchesGroup(f, 'ok')).length
      const failedCount = this.files.filter(f => this.matchesGroup(f, 'failed')).length
      const timeoutCount = this.files.filter(f => this.matchesGroup(f, 'timeout')).length
      const processingCount = this.files.filter(f => this.matchesGroup(f, 'processing')).length

      const groups: TreeNode[] = []

      groups.push({ type: 'separator', label: '── Analysis Results ──' })

      if (processingCount > 0) {
        groups.push({ type: 'statusGroup', status: 'processing' })
      } else {
        groups.push({ type: 'statusGroup', status: 'ok' })
        groups.push({ type: 'statusGroup', status: 'failed' })
        groups.push({ type: 'statusGroup', status: 'timeout' })
      }

      const infoNodes = this.createInfoNodes()
      groups.push(...infoNodes)

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

    return Promise.resolve([])
  }

  private matchesGroup(file: FileStatus, status: Status): boolean {
    switch (status) {
      case 'processing': return file.status === 'processing'
      case 'timeout': return file.status === 'timeout'
      case 'failed': return file.status === 'failed' && file.errors > 0
      case 'ok': return file.status === 'ok' && file.errors === 0
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

  private createInfoNodes(): TreeNode[] {
    const nodes: TreeNode[] = []
    
    nodes.push({ type: 'separator', label: '' })
    nodes.push({ type: 'separator', label: '' })
    
    nodes.push({ type: 'separator', label: '── Information ──' })
    
    if (this.lastAnalysisTime) {
      const timeString = this.lastAnalysisTime.toLocaleString()
      nodes.push({ type: 'timestamp', label: 'Last Analyzed', value: timeString })
    }
    
    nodes.push({ type: 'versionInfo', label: 'VS Code Extension', value: this.extensionVersion })
    
    const herbComponents = this.parseHerbVersion(this.herbVersions)
    herbComponents.forEach(component => {
      nodes.push({ type: 'versionInfo', label: component.name, value: component.version })
    })
    
    return nodes
  }

  private parseHerbVersion(versionString: string): { name: string; version: string }[] {
    if (versionString === 'Loading...' || versionString === 'Error loading versions' || versionString === 'Not analyzed yet') {
      return [{ name: 'Herb Parser', version: versionString }]
    }
    
    const components: { name: string; version: string }[] = []
    const parts = versionString.split(', ')
    
    for (const part of parts) {
      const trimmedPart = part.trim()
      const lastAtIndex = trimmedPart.lastIndexOf('@')
      
      if (lastAtIndex >= 0) {
        const name = trimmedPart.substring(0, lastAtIndex)
        const versionPart = trimmedPart.substring(lastAtIndex + 1)
        
        const spaceIndex = versionPart.indexOf(' ')
        const version = spaceIndex > 0 ? versionPart.substring(0, spaceIndex) : versionPart
        const suffix = spaceIndex > 0 ? versionPart.substring(spaceIndex).trim() : ''
        
        components.push({ 
          name: this.formatComponentName(name), 
          version: suffix ? `${version} ${suffix}` : version
        })
      }
    }
    
    return components.length > 0 ? components : [{ name: 'Herb Parser', version: versionString }]
  }

  private formatComponentName(name: string): string {
    return name
  }

  async analyzeProject() {
    const uris = await vscode.workspace.findFiles('**/*.html.erb')

    this.lastAnalysisTime = new Date()
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

        const cpus = Math.max(1, require('os').cpus().length)
        const queue = uris.slice()
        const workers: Promise<void>[] = Array(cpus)
          .fill(undefined)
          .map(async () => {
            while (queue.length) {
              const uri = queue.shift()!
              const { status, errors } = await this.parseFile(uri.fsPath)
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
      const status: Status = failed ? 'failed' : 'ok'
      const returnValue = { status, errors: result.errors as number }
      
      if (result.version && result.version !== this.herbVersions) {
        this.herbVersions = result.version
        this._onDidChangeTreeData.fire()
      }
      
      console.log(`Parse result for ${file}: stdout="${stdout.trim()}", parsed=${JSON.stringify(result)}, returning=${JSON.stringify(returnValue)}`)
      
      return returnValue
    } catch (error: any) {
      if (error.killed) {
        return { status: 'timeout' as Status, errors: 0 }
      }

      if (error.stdout) {
        try {
          const result = JSON.parse(error.stdout.trim())
          const failed = result.errors > 0
          const status: Status = failed ? 'failed' : 'ok'
          
          if (result.version && result.version !== this.herbVersions) {
            this.herbVersions = result.version
            this._onDidChangeTreeData.fire()
          }
          
          return { status, errors: result.errors as number }
        } catch (parseError) {
          return { status: 'failed' as Status, errors: 1 }
        }
      }

      return { status: 'failed' as Status, errors: 1 }
    }
  }
}
