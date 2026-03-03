import * as vscode from "vscode"
import { Config } from "@herb-tools/config"

export class HerbConfigProvider implements vscode.TreeDataProvider<ConfigItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null | void> = new vscode.EventEmitter<ConfigItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null | void> = this._onDidChangeTreeData.event

  private config: Config | null = null
  private workspaceRoot: string | undefined
  private onConfigChangeCallback?: () => void | Promise<void>
  private extensionVersion: string
  private configError: string | null = null

  constructor(context: vscode.ExtensionContext, onConfigChange?: () => void | Promise<void>) {
    this.onConfigChangeCallback = onConfigChange
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    const packageJson = require(context.asAbsolutePath('package.json'))
    this.extensionVersion = packageJson.version

    this.loadConfig().then(() => {
      this._onDidChangeTreeData.fire()
    })

    if (this.workspaceRoot) {
      const herbYmlPattern = new vscode.RelativePattern(this.workspaceRoot, ".herb.yml")
      const watcher = vscode.workspace.createFileSystemWatcher(herbYmlPattern)

      watcher.onDidCreate(() => void this.refresh())
      watcher.onDidChange(() => void this.refresh())
      watcher.onDidDelete(() => void this.refresh())

      context.subscriptions.push(watcher)
    }

    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.fileName.endsWith('.herb.yml')) {
          void this.refresh()
        }
      })
    )

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('languageServerHerb')) {
          void this.refresh()
        }
      })
    )
  }

  async refresh(): Promise<void> {
    await this.loadConfig()
    this._onDidChangeTreeData.fire()

    if (this.onConfigChangeCallback) {
      await this.onConfigChangeCallback()
    }
  }

  getTreeItem(element: ConfigItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: ConfigItem): Thenable<ConfigItem[]> {
    if (!this.workspaceRoot) {
      return Promise.resolve([])
    }

    if (element) {
      return Promise.resolve([])
    } else {
      return Promise.resolve(this.getConfigItems())
    }
  }

  private async loadConfig() {
    if (!this.workspaceRoot) {
      this.config = null
      this.configError = null
      return
    }

    const configPath = Config.configPathFromProjectPath(this.workspaceRoot)

    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(configPath))
    } catch {
      this.config = null
      this.configError = null
      vscode.commands.executeCommand('setContext', 'herb.hasProjectConfig', false)
      return
    }

    try {
      this.config = await Config.loadForEditor(configPath, this.extensionVersion)
      this.configError = null

      vscode.commands.executeCommand('setContext', 'herb.hasProjectConfig', true)

      const configVersion = this.config.config.version

      if (configVersion && configVersion !== this.extensionVersion) {
        vscode.window.showWarningMessage(
          `Herb configuration version (${configVersion}) doesn't match VS Code extension version (${this.extensionVersion}). Consider updating your configuration or extension.`,
          'Edit Config'
        ).then(selection => {
          if (selection === 'Edit Config') {
            this.editConfig()
          }
        })
      }
    } catch (error) {
      this.config = null
      this.configError = error instanceof Error ? error.message : String(error)
      vscode.commands.executeCommand('setContext', 'herb.hasProjectConfig', false)
    }
  }

  private getConfigItems(): ConfigItem[] {
    const items: ConfigItem[] = []

    if (this.config) {
      const configFileItem = new ConfigItem(
        "Project Settings",
        "Configuration from .herb.yml",
        vscode.TreeItemCollapsibleState.None,
        'configFile'
      )
      configFileItem.iconPath = new vscode.ThemeIcon('file-code')
      configFileItem.command = {
        command: 'herb.editConfig',
        title: 'Edit Configuration',
        arguments: []
      }

      items.push(configFileItem)

      const linterEnabled = this.config.isLinterEnabled
      const disabledRulesCount = this.config.linter?.rules
        ? Object.values(this.config.linter.rules).filter(r => r.enabled === false).length
        : 0

      const linterItem = new ConfigItem(
        `Herb Linter: ${linterEnabled ? 'Enabled' : 'Disabled'}`,
        disabledRulesCount
          ? `${disabledRulesCount} rules disabled`
          : "All rules enabled",
        vscode.TreeItemCollapsibleState.None,
        'linterSetting'
      )
      linterItem.iconPath = linterEnabled
        ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'))
      linterItem.command = {
        command: 'herb.toggleLinter',
        title: 'Toggle Linter',
        arguments: []
      }
      items.push(linterItem)

      const formatterEnabled = this.config.isFormatterEnabled
      const formatterItem = new ConfigItem(
        `Herb Formatter: ${formatterEnabled ? 'Enabled' : 'Disabled'}`,
        formatterEnabled
          ? `Indent: ${this.config.formatter?.indentWidth ?? 2}, Max length: ${this.config.formatter?.maxLineLength ?? 80}`
          : "Experimental feature",
        vscode.TreeItemCollapsibleState.None,
        'formatterSetting'
      )
      formatterItem.iconPath = formatterEnabled
        ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'))
      formatterItem.command = {
        command: 'herb.toggleFormatter',
        title: 'Toggle Formatter',
        arguments: []
      }
      items.push(formatterItem)
    } else if (this.configError) {
      const errorItem = new ConfigItem(
        "Configuration has errors",
        "Click to view and fix errors in .herb.yml",
        vscode.TreeItemCollapsibleState.None,
        'configError'
      )
      errorItem.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
      errorItem.command = {
        command: 'herb.editConfig',
        title: 'Edit Configuration',
        arguments: []
      }
      items.push(errorItem)

      const errorDetail = new ConfigItem(
        this.configError.split('\n')[0].substring(0, 60),
        "See file for full details",
        vscode.TreeItemCollapsibleState.None,
        'errorDetail'
      )
      errorDetail.iconPath = new vscode.ThemeIcon('warning')
      items.push(errorDetail)
    } else {
      const personalSettingsItem = new ConfigItem(
        "Personal Settings",
        "Using VS Code settings",
        vscode.TreeItemCollapsibleState.None,
        'personalSettings'
      )
      personalSettingsItem.iconPath = new vscode.ThemeIcon('settings-gear')
      personalSettingsItem.command = {
        command: 'workbench.action.openSettings',
        title: 'Open Herb Settings',
        arguments: ['languageServerHerb']
      }
      items.push(personalSettingsItem)

      const vscodeConfig = vscode.workspace.getConfiguration('languageServerHerb')
      const linterEnabled = vscodeConfig.get('linter.enabled', true)
      const formatterEnabled = vscodeConfig.get('formatter.enabled', false)

      const linterItem = new ConfigItem(
        `Herb Linter: ${linterEnabled ? 'Enabled' : 'Disabled'}`,
        "From VS Code settings",
        vscode.TreeItemCollapsibleState.None,
        'personalLinterSetting'
      )
      linterItem.iconPath = linterEnabled
        ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'))
      linterItem.command = {
        command: 'workbench.action.openSettings',
        title: 'Open Linter Settings',
        arguments: ['languageServerHerb.linter']
      }
      items.push(linterItem)

      const formatterItem = new ConfigItem(
        `Herb Formatter: ${formatterEnabled ? 'Enabled' : 'Disabled'}`,
        "From VS Code settings",
        vscode.TreeItemCollapsibleState.None,
        'personalFormatterSetting'
      )
      formatterItem.iconPath = formatterEnabled
        ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'))
      formatterItem.command = {
        command: 'workbench.action.openSettings',
        title: 'Open Formatter Settings',
        arguments: ['languageServerHerb.formatter']
      }
      items.push(formatterItem)

      const createConfigItem = new ConfigItem(
        "Create .herb.yml",
        "Share settings with your project",
        vscode.TreeItemCollapsibleState.None,
        'createConfig'
      )
      createConfigItem.iconPath = new vscode.ThemeIcon('add')
      createConfigItem.command = {
        command: 'herb.createConfig',
        title: 'Create Configuration',
        arguments: []
      }
      items.push(createConfigItem)
    }

    return items
  }

  async createConfig(): Promise<void> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open")
      return
    }

    try {
      const configPath = Config.configPathFromProjectPath(this.workspaceRoot)

      await Config.mutateConfigFile(configPath, {})

      vscode.window.showInformationMessage("Created Herb configuration file (.herb.yml)")
      await this.refresh()

      const document = await vscode.workspace.openTextDocument(configPath)
      await vscode.window.showTextDocument(document)
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create Herb config: ${error}`)
    }
  }

  async editConfig(): Promise<void> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open")
      return
    }

    const configPath = Config.configPathFromProjectPath(this.workspaceRoot)

    try {
      const document = await vscode.workspace.openTextDocument(configPath)
      await vscode.window.showTextDocument(document)
    } catch (_error) {
      const result = await vscode.window.showInformationMessage(
        "Herb configuration file (.herb.yml) not found. Would you like to create one?",
        "Create Config",
        "Cancel"
      )

      if (result === "Create Config") {
        await this.createConfig()
      }
    }
  }

  hasConfig(): boolean {
    return this.config !== null
  }

  getConfig(): Config | null {
    return this.config
  }
}

class ConfigItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string
  ) {
    super(label, collapsibleState)

    this.tooltip = `${this.label}: ${this.description}`
  }
}
