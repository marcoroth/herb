import * as vscode from "vscode"
import * as path from "path"
import type { TextEdit } from "vscode-languageclient/node"

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

import type { ExtractToPartialArguments, ExtractToPartialResult } from "./types"

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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath))

    return true
  } catch (_error) {
    return false
  }
}

async function findMisnamedConfigPaths(workspaceRoot: string): Promise<string[]> {
  const misnamedPaths: string[] = []

  for (const misnamedConfigPath of Config.misnamedConfigPaths) {
    const candidate = path.join(workspaceRoot, misnamedConfigPath)

    if (await fileExists(candidate)) {
      misnamedPaths.push(candidate)
    }
  }

  const activeDocumentPath = vscode.window.activeTextEditor?.document.uri.fsPath

  if (activeDocumentPath && Config.isMisnamedConfigPath(activeDocumentPath) && !misnamedPaths.includes(activeDocumentPath)) {
    misnamedPaths.unshift(activeDocumentPath)
  }

  return misnamedPaths
}

async function updateConfigStatusBarItem() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

  if (!workspaceRoot) {
    configStatusBarItem.hide()

    return
  }

  const misnamedPaths = await findMisnamedConfigPaths(workspaceRoot)

  if (misnamedPaths.length > 0) {
    const misnamedPath = misnamedPaths[0]
    const misnamedNames = misnamedPaths.map(misnamedConfigPath => path.basename(misnamedConfigPath)).join(', ')
    const verb = misnamedPaths.length === 1 ? 'is' : 'are'

    configStatusBarItem.text = `$(warning) ${path.basename(misnamedPath)} (Not Read)`
    configStatusBarItem.tooltip = `Herb only reads ${Config.configPath}, so ${misnamedNames} ${verb} ignored.\n\nRename to ${Config.configPath} to apply the configuration.\n\nClick to open ${path.basename(misnamedPath)}`
    configStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground')
    configStatusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground')
    configStatusBarItem.command = {
      title: `Open ${path.basename(misnamedPath)}`,
      command: 'vscode.open',
      arguments: [vscode.Uri.file(misnamedPath)]
    }

    configStatusBarItem.show()

    return
  }

  const configPath = Config.configPathFromProjectPath(workspaceRoot)

  configStatusBarItem.backgroundColor = undefined
  configStatusBarItem.color = undefined
  configStatusBarItem.command = 'herb.showConfigDetails'

  if (await fileExists(configPath)) {
    configStatusBarItem.text = `$(file-code) ${Config.configPath} (Project Settings)`
    configStatusBarItem.tooltip = `Herb configuration loaded from ${Config.configPath} (overrides VS Code settings)\n\nClick to view configuration details`
  } else {
    configStatusBarItem.text = '$(settings-gear) Herb (Personal Settings)'
    configStatusBarItem.tooltip = `Herb using personal VS Code settings\n\nClick to view configuration details or create ${Config.configPath}`
  }

  configStatusBarItem.show()
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Herb extension...")

  configStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  context.subscriptions.push(configStatusBarItem)

  client = new Client(context)

  context.subscriptions.push(
    vscode.commands.registerCommand('herb.extractToPartial', async (args?: ExtractToPartialArguments) => {
      await extractToPartial(args)
    })
  )

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
    }),

    vscode.commands.registerCommand('herb.toggleLineComment', async () => {
      const editor = vscode.window.activeTextEditor

      if (editor) {
        await sendCommentRequest(editor, 'herb/toggleLineComment')
      }
    }),

    vscode.commands.registerCommand('herb.toggleBlockComment', async () => {
      const editor = vscode.window.activeTextEditor

      if (editor) {
        await sendCommentRequest(editor, 'herb/toggleBlockComment')
      }
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

  const configWatcher = vscode.workspace.createFileSystemWatcher(`**/{${Config.configPath},${Config.misnamedConfigPaths.join(",")}}`)

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

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async () => {
    await updateConfigStatusBarItem()
  }))

  await updateConfigStatusBarItem()
  await runAutoAnalysis()

  console.log("Herb extension is now active!")
}

async function sendCommentRequest(editor: vscode.TextEditor, method: string) {
  const selection = editor.selection
  const edits = await client.sendRequest<TextEdit[]>(method, {
    textDocument: { uri: editor.document.uri.toString() },
    range: {
      start: { line: selection.start.line, character: selection.start.character },
      end: { line: selection.end.line, character: selection.end.character }
    }
  })

  if (edits && edits.length > 0) {
    await editor.edit(editBuilder => {
      for (const edit of edits) {
        const range = new vscode.Range(
          new vscode.Position(edit.range.start.line, edit.range.start.character),
          new vscode.Position(edit.range.end.line, edit.range.end.character)
        )

        editBuilder.replace(range, edit.newText)
      }
    })
  }
}

async function extractToPartial(args?: ExtractToPartialArguments) {
  const request = args ?? selectionArguments()

  if (!request) {
    await vscode.window.showErrorMessage("Herb: Select the markup you want to extract into a partial first.")

    return
  }

  await promptAndExtract(request)
}

function selectionArguments(): ExtractToPartialArguments | null {
  const editor = vscode.window.activeTextEditor

  if (!editor || editor.selection.isEmpty) return null

  return {
    uri: editor.document.uri.toString(),
    range: {
      start: { line: editor.selection.start.line, character: editor.selection.start.character },
      end: { line: editor.selection.end.line, character: editor.selection.end.character }
    },
    suggestedName: "",
    locals: []
  }
}

async function promptAndExtract(args: ExtractToPartialArguments) {
  const locals = args.locals.length > 0 ? ` Locals: ${args.locals.map(local => `${local}:`).join(", ")}` : ""

  const name = await vscode.window.showInputBox({
    title: "Extract to partial",
    prompt: `Name for the new partial, optionally with a path relative to app/views.${locals}`,
    value: args.suggestedName,
    validateInput: (value) => {
      return /^[a-zA-Z0-9_\-/]+$/.test(value.trim()) ? null : "Use letters, numbers, underscores, dashes and slashes."
    }
  })

  if (!name) return

  const result = await client.sendRequest<ExtractToPartialResult>('herb/extractToPartial', {
    textDocument: { uri: args.uri },
    range: args.range,
    name
  })

  if (!result || "error" in result) {
    await vscode.window.showErrorMessage(`Herb: ${result?.error ?? "Could not extract the selection into a partial."}`)

    return
  }

  const applied = await client.applyWorkspaceEdit(result.edit)

  if (!applied) {
    await vscode.window.showErrorMessage("Herb: Could not apply the extraction.")

    return
  }

  await vscode.window.showTextDocument(vscode.Uri.parse(result.uri))
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
