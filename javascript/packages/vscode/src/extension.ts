import * as vscode from "vscode"

import { Client } from "./client"
import { HerbAnalysisProvider } from "./herb-analysis-provider"

let client: Client
let analysisProvider: HerbAnalysisProvider

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Herb LSP...")

  client = new Client(context)

  await client.start()

  analysisProvider = new HerbAnalysisProvider(context)

  vscode.window.createTreeView('herbFileStatus', { treeDataProvider: analysisProvider })

  context.subscriptions.push(
    vscode.commands.registerCommand('herb.analyzeProject', async () => {
      await analysisProvider.analyzeProject()
    }),
    vscode.commands.registerCommand('herb.reprocessFile', async (item: any) => {
      await analysisProvider.reprocessFile(item.uri)
    })
  )

  // Auto-run analyze project if HTML+ERB files exist
  await runAutoAnalysis()

  console.log("Herb LSP is now active!")
}

async function runAutoAnalysis() {
  if (!vscode.workspace.workspaceFolders) {
    return
  }

  const erbFiles = await vscode.workspace.findFiles('**/*.html.erb')
  if (erbFiles.length === 0) {
    return
  }

  console.log(`Found ${erbFiles.length} HTML+ERB files. Running auto-analysis...`)
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
