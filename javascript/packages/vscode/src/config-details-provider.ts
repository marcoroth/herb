import * as vscode from "vscode"
import { Config } from "@herb-tools/config"

interface ConfigQuickPickItem extends vscode.QuickPickItem {
  action?: () => Promise<void>
}

export async function showConfigDetails() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  const vscodeConfig = vscode.workspace.getConfiguration('languageServerHerb')

  const items: ConfigQuickPickItem[] = []

  const configPath = workspaceRoot ? Config.configPathFromProjectPath(workspaceRoot) : null
  let hasConfigFile = false
  let config: Config | null = null

  if (configPath) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(configPath))

      hasConfigFile = true
      config = await Config.loadForEditor(workspaceRoot!)
    } catch (_error) {
      // No config file or failed to load
    }
  }

  const configSourceItem: ConfigQuickPickItem = hasConfigFile
    ? {
        label: "$(file-code) Herb Configuration Source",
        detail: ".herb.yml (project configuration overrides VS Code settings)",
        description: ""
      }
    : {
        label: "$(settings-gear) Herb Configuration Source",
        detail: "VS Code Settings (personal settings)",
        description: "no .herb.yml"
      }

  if (!hasConfigFile) {
    configSourceItem.action = async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'languageServerHerb')
    }
  }

  items.push(configSourceItem)

  const linterEnabled = config?.linter?.enabled ?? vscodeConfig.get('linter.enabled', true)
  const disabledRules = config?.linter?.rules
    ? Object.entries(config.linter.rules)
        .filter(([_, ruleConfig]) => ruleConfig.enabled === false)
        .map(([name, _]) => name)
    : []

  const linterIcon = linterEnabled ? "$(check)" : "$(x)"
  const linterStatus = linterEnabled ? "Enabled" : "Disabled"
  const linterDetail = disabledRules.length > 0
    ? `${disabledRules.length} rule${disabledRules.length === 1 ? '' : 's'} disabled: ${disabledRules.slice(0, 3).join(', ')}${disabledRules.length > 3 ? '...' : ''}`
    : "All rules enabled"

  const linterItem: ConfigQuickPickItem = {
    label: `${linterIcon} Herb Linter: ${linterStatus}`,
    detail: linterDetail,
    description: ""
  }

  if (hasConfigFile) {
    linterItem.action = async () => {
      await vscode.commands.executeCommand('herb.toggleLinter')
    }
  } else {
    linterItem.action = async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'languageServerHerb.linter')
    }
  }

  items.push(linterItem)

  const formatterEnabled = config?.formatter?.enabled ?? vscodeConfig.get('formatter.enabled', false)
  const indentWidth = config?.formatter?.indentWidth ?? vscodeConfig.get('formatter.indentWidth', 2)
  const maxLineLength = config?.formatter?.maxLineLength ?? vscodeConfig.get('formatter.maxLineLength', 80)

  const formatterIcon = formatterEnabled ? "$(check)" : "$(x)"
  const formatterStatus = formatterEnabled ? "Enabled" : "Disabled"
  const formatterDetail = `Indent: ${indentWidth} spaces, Max length: ${maxLineLength}`

  const formatterItem: ConfigQuickPickItem = {
    label: `${formatterIcon} Herb Formatter: ${formatterStatus}`,
    detail: formatterDetail,
    description: formatterEnabled ? "" : "experimental"
  }

  if (hasConfigFile) {
    formatterItem.action = async () => {
      await vscode.commands.executeCommand('herb.toggleFormatter')
    }
  } else {
    formatterItem.action = async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'languageServerHerb.formatter')
    }
  }

  items.push(formatterItem)

  items.push({
    label: "Actions",
    kind: vscode.QuickPickItemKind.Separator
  })

  if (hasConfigFile) {
    items.push({
      label: "$(edit) Edit .herb.yml",
      description: "Open configuration file",
      action: async () => {
        const document = await vscode.workspace.openTextDocument(configPath!)
        await vscode.window.showTextDocument(document)
      }
    })
  } else {
    items.push({
      label: "$(new-file) Create .herb.yml",
      description: "Create project configuration file",
      action: async () => {
        await vscode.commands.executeCommand('herb.createConfig')
      }
    })
  }

  const selected = await vscode.window.showQuickPick(items, {
    title: "Herb Configuration",
    placeHolder: "Select an action or press Escape to close"
  })

  if (selected && selected.action) {
    await selected.action()
  }
}
