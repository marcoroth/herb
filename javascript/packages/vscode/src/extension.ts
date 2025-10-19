import * as vscode from "vscode"

import { HERB_FILES_GLOB } from "@herb-tools/core"

import { Client } from "./client"
import { HerbAnalysisProvider } from "./herb-analysis-provider"
import { HerbCodeActionProvider } from "./code-action-provider"
import {
  reportIssue,
  reportDetailedIssue,
  reportGeneralIssue,
  reportDiagnosticIssue
} from "./issue-reporter"

let client: Client
let analysisProvider: HerbAnalysisProvider

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Herb LSP...")

  client = new Client(context)

  await client.start()

  analysisProvider = new HerbAnalysisProvider(context)

  vscode.window.createTreeView('herbFileStatus', { treeDataProvider: analysisProvider })

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
    })
  )

  const fileWatcher = vscode.workspace.createFileSystemWatcher(HERB_FILES_GLOB)

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

  await runAutoAnalysis()

  console.log("Herb LSP is now active!")
}

async function runAutoAnalysis() {
  if (!vscode.workspace.workspaceFolders) {
    return
  }

  const files = await vscode.workspace.findFiles(HERB_FILES_GLOB)
  if (files.length === 0) {
    return
  }

  console.log(`Found ${files.length} HTML+ERB files. Running auto-analysis...`)

  await analysisProvider.analyzeProject()
}


export async function deactivate(): Promise<void> {
  console.log("Deactivating Herb LSP...")

  if (client) {
    await client.stop()

    console.log("Herb LSP is now deactivated!")
  } else {
    return undefined
  }
}
