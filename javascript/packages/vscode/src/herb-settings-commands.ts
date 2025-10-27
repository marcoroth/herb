import * as vscode from "vscode"
import * as path from "path"

import { Config } from "@herb-tools/config"
import { HerbConfigProvider } from "./config-provider"

/**
 * Commands to modify .herb.yml settings directly through VS Code
 */
export class HerbSettingsCommands {
  constructor(private context: vscode.ExtensionContext, private configProvider?: HerbConfigProvider) {
    this.registerCommands()
  }

  private registerCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('herb.toggleLinter', () => this.toggleLinter()),
      vscode.commands.registerCommand('herb.toggleFormatter', () => this.toggleFormatter()),
      vscode.commands.registerCommand('herb.setIndentWidth', () => this.setIndentWidth()),
      vscode.commands.registerCommand('herb.setMaxLineLength', () => this.setMaxLineLength()),
    )
  }

  private async getOrCreateConfig(): Promise<Config | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open")

      return null
    }

    try {
      return await Config.load(workspaceRoot, { silent: true, createIfMissing: false })
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load config: ${error}`)

      return null
    }
  }

  private async getConfigPath(): Promise<string | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open")

      return null
    }

    return Config.configPathFromProjectPath(workspaceRoot)
  }

  private async toggleLinter() {
    const config = await this.getOrCreateConfig()
    if (!config) {return}

    const configPath = await this.getConfigPath()
    if (!configPath) {return}

    const currentState = config.config.linter?.enabled ?? true

    const choice = await vscode.window.showQuickPick([
      {
        label: 'Enabled',
        description: currentState ? '(current)' : '',
        value: true
      },
      {
        label: 'Disabled',
        description: !currentState ? '(current)' : '',
        value: false
      }
    ], {
      placeHolder: 'Select linter state for Herb configuration'
    })

    if (choice === undefined) {return}

    try {
      await Config.mutateConfigFile(configPath, {
        linter: { enabled: choice.value }
      })

      vscode.window.showInformationMessage(
        `Herb Linter ${choice.value ? 'enabled' : 'disabled'} in Herb configuration`
      )

      vscode.commands.executeCommand('herb.refreshLanguageServer')
      if (this.configProvider) {
        await this.configProvider.refresh()
      }

      await this.openConfigFile()
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update Herb config: ${error}`)
    }
  }

  private async toggleFormatter() {
    const config = await this.getOrCreateConfig()
    if (!config) {return}

    const configPath = await this.getConfigPath()
    if (!configPath) {return}

    const currentState = config.config.formatter?.enabled ?? false

    const choice = await vscode.window.showQuickPick([
      {
        label: 'Enabled',
        description: currentState ? '(current)' : '',
        value: true
      },
      {
        label: 'Disabled',
        description: !currentState ? '(current)' : '',
        value: false
      }
    ], {
      placeHolder: 'Select formatter state for Herb configuration'
    })

    if (choice === undefined) {return}

    try {
      await Config.mutateConfigFile(configPath, {
        formatter: { enabled: choice.value }
      })

      vscode.window.showInformationMessage(
        `Herb Formatter ${choice.value ? 'enabled' : 'disabled'} in Herb configuration`
      )

      vscode.commands.executeCommand('herb.refreshLanguageServer')
      if (this.configProvider) {
        await this.configProvider.refresh()
      }

      await this.openConfigFile()
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update Herb config: ${error}`)
    }
  }

  private async setIndentWidth() {
    const config = await this.getOrCreateConfig()
    if (!config) {return}

    const configPath = await this.getConfigPath()
    if (!configPath) {return}

    const input = await vscode.window.showInputBox({
      prompt: "Enter indent width (number of spaces)",
      value: config.config.formatter?.indentWidth?.toString() ?? "2",
      validateInput: (value) => {
        const num = parseInt(value)

        if (isNaN(num) || num < 1 || num > 10) {
          return "Please enter a number between 1 and 10"
        }

        return null
      }
    })

    if (input === undefined) {return}

    const indentWidth = parseInt(input)

    try {
      await Config.mutateConfigFile(configPath, {
        formatter: { indentWidth }
      })

      vscode.window.showInformationMessage(
        `Herb formatter indent width set to ${indentWidth} spaces`
      )

      vscode.commands.executeCommand('herb.refreshLanguageServer')

      if (this.configProvider) {
        await this.configProvider.refresh()
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update Herb config: ${error}`)
    }
  }

  private async setMaxLineLength() {
    const config = await this.getOrCreateConfig()
    if (!config) {return}

    const configPath = await this.getConfigPath()
    if (!configPath) {return}

    const input = await vscode.window.showInputBox({
      prompt: "Enter maximum line length",
      value: config.config.formatter?.maxLineLength?.toString() ?? "80",
      validateInput: (value) => {
        const num = parseInt(value)

        if (isNaN(num) || num < 40 || num > 200) {
          return "Please enter a number between 40 and 200"
        }

        return null
      }
    })

    if (input === undefined) {return}

    const maxLineLength = parseInt(input)

    try {
      await Config.mutateConfigFile(configPath, {
        formatter: { maxLineLength }
      })

      vscode.window.showInformationMessage(
        `Herb formatter max line length set to ${maxLineLength} characters`
      )

      vscode.commands.executeCommand('herb.refreshLanguageServer')

      if (this.configProvider) {
        await this.configProvider.refresh()
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update Herb config: ${error}`)
    }
  }

  private async openConfigFile(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

    if (!workspaceRoot) { return }

    const configPath = path.join(workspaceRoot, ".herb.yml")

    try {
      const document = await vscode.workspace.openTextDocument(configPath)

      await vscode.window.showTextDocument(document)
    } catch (error) {
      console.log(`Could not open config file: ${error}`)
    }
  }
}
