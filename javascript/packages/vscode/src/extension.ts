import * as vscode from "vscode"

import { Config } from "@herb-tools/config"

import { Client } from "./client"
import { HerbAnalysisProvider } from "./herb-analysis-provider"
import { HerbCodeActionProvider } from "./code-action-provider"
import { HerbConfigProvider } from "./config-provider"
import { HerbInformationProvider } from "./herb-information-provider"
import { HerbSupportProvider } from "./herb-support-provider"
import { HerbSettingsCommands } from "./herb-settings-commands"

import { showConfigDetails } from "./config-details-provider"

import {
  reportIssue,
  reportDetailedIssue,
  reportGeneralIssue,
  reportDiagnosticIssue
} from "./issue-reporter"

let client: Client
let analysisProvider: HerbAnalysisProvider
let configProvider: HerbConfigProvider
let informationProvider: HerbInformationProvider
let supportProvider: HerbSupportProvider
let settingsCommands: HerbSettingsCommands
let configStatusBarItem: vscode.StatusBarItem

function getFileGlobPattern(): string {
  return Config.getDefaultFilePatterns().join(",")
}

async function updateConfigStatusBarItem() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  if (!workspaceRoot) {
    configStatusBarItem.hide()

    return
  }

  const configPath = Config.configPathFromProjectPath(workspaceRoot)

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(configPath))

    configStatusBarItem.text = '$(file-code) .herb.yml (Project Settings)'
    configStatusBarItem.tooltip = 'Herb configuration loaded from .herb.yml (overrides VS Code settings)\n\nClick to view configuration details'
    configStatusBarItem.command = 'herb.showConfigDetails'

    configStatusBarItem.show()
  } catch (_error) {
    configStatusBarItem.text = '$(settings-gear) Herb (Personal Settings)'
    configStatusBarItem.tooltip = 'Herb using personal VS Code settings\n\nClick to view configuration details or create .herb.yml'
    configStatusBarItem.command = 'herb.showConfigDetails'

    configStatusBarItem.show()
  }
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Herb extension...")

  configStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  context.subscriptions.push(configStatusBarItem)

  client = new Client(context)

  await client.start()

  informationProvider = new HerbInformationProvider(context)
  supportProvider = new HerbSupportProvider()

  analysisProvider = new HerbAnalysisProvider(context, (lastAnalysisTime) => {
    informationProvider.updateLastAnalysisTime(lastAnalysisTime)
  }, () => {
    informationProvider.updateVersions()
  })

  configProvider = new HerbConfigProvider(context, async () => {
    await client.updateConfiguration()
    analysisProvider.clearAnalysis()
  })

  settingsCommands = new HerbSettingsCommands(context, configProvider)
  void settingsCommands

  vscode.window.createTreeView('herbFileStatus', { treeDataProvider: analysisProvider })
  vscode.window.createTreeView('herbConfiguration', { treeDataProvider: configProvider })
  vscode.window.createTreeView('herbInformation', { treeDataProvider: informationProvider })
  vscode.window.createTreeView('herbSupport', { treeDataProvider: supportProvider })

  const codeActionProvider = new HerbCodeActionProvider()

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'erb', scheme: 'file' },
      codeActionProvider
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('herb.analyzeProject', async () => {
      await analysisProvider.analyzeProject()
    }),

    vscode.commands.registerCommand('herb.reprocessFile', async (item: any) => {
      if (!item || !item.uri) {
        const activeEditor = vscode.window.activeTextEditor

        if (activeEditor) {
          await analysisProvider.reprocessFile(activeEditor.document.uri)
        } else {
          vscode.window.showErrorMessage('No file selected to re-analyze')
        }

        return
      }

      await analysisProvider.reprocessFile(item.uri)
    }),

    vscode.commands.registerCommand('herb.reportIssue', async (item: any) => {
      await reportIssue(item)
    }),

    vscode.commands.registerCommand('herb.reportDetailedIssue', async (item?: any) => {
      await reportDetailedIssue(item)
    }),

    vscode.commands.registerCommand('herb.reportGeneralIssue', async () => {
      await reportGeneralIssue()
    }),

    vscode.commands.registerCommand('herb.reportDiagnosticIssue', async (uri?: vscode.Uri, diagnostic?: vscode.Diagnostic) => {
      if (!uri || !diagnostic) {
        vscode.window.showErrorMessage('This command can only be used on diagnostics. Please right-click on an error or warning to report an issue.')

        return
      }

      await reportDiagnosticIssue(uri, diagnostic)
    }),

    vscode.commands.registerCommand('herb.createConfig', async () => {
      await configProvider.createConfig()
    }),

    vscode.commands.registerCommand('herb.editConfig', async () => {
      await configProvider.editConfig()
    }),

    vscode.commands.registerCommand('herb.showConfigDetails', async () => {
      await showConfigDetails()
    }),

    vscode.commands.registerCommand('herb.refreshLanguageServer', async () => {
      await client.updateConfiguration()
    })
  )

  const fileWatcher = vscode.workspace.createFileSystemWatcher(getFileGlobPattern())

  fileWatcher.onDidChange(async (uri) => {
    console.log(`File changed: ${uri.fsPath}`)
    await analysisProvider.reprocessFile(uri)
  })

  fileWatcher.onDidCreate(async (uri) => {
    console.log(`File created: ${uri.fsPath}`)
    await analysisProvider.reprocessFile(uri)
  })

  fileWatcher.onDidDelete(async (uri) => {
    console.log(`File deleted: ${uri.fsPath}`)
    await analysisProvider.removeFile(uri)
  })

  context.subscriptions.push(fileWatcher)

  const configWatcher = vscode.workspace.createFileSystemWatcher('**/.herb.yml')

  configWatcher.onDidCreate(async () => {
    await updateConfigStatusBarItem()
  })

  configWatcher.onDidChange(async () => {
    await updateConfigStatusBarItem()
  })

  configWatcher.onDidDelete(async () => {
    await updateConfigStatusBarItem()
  })

  context.subscriptions.push(configWatcher)

  await updateConfigStatusBarItem()
  await runAutoAnalysis()

  console.log("Herb extension is now active!")
}


async function runAutoAnalysis() {
  if (!vscode.workspace.workspaceFolders) {
    return
  }

  const files = await vscode.workspace.findFiles(getFileGlobPattern())

  if (files.length === 0) {
    return
  }

  console.log(`Found ${files.length} HTML+ERB files. Running auto-analysis...`)

  await analysisProvider.analyzeProject()
}


export async function deactivate(): Promise<void> {
  console.log("Deactivating Herb extension...")

  if (client) {
    await client.stop()

    console.log("Herb extension is now deactivated!")
  } else {
    return undefined
  }
}
