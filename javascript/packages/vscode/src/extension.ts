import * as vscode from "vscode"

import { Client } from "./client"
import { HerbFileStatusProvider } from "./fileStatusProvider"

let client: Client
let fileStatusProvider: HerbFileStatusProvider

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Herb LSP...")

  client = new Client(context)

  await client.start()

  fileStatusProvider = new HerbFileStatusProvider(context)

  vscode.window.createTreeView('herbFileStatus', { treeDataProvider: fileStatusProvider })

  context.subscriptions.push(
    vscode.commands.registerCommand('herb.analyzeProject', async () => {
      await fileStatusProvider.analyzeProject()
    }),
    vscode.commands.registerCommand('herb.reprocessFile', async (item: any) => {
      await fileStatusProvider.reprocessFile(item.uri)
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
  await fileStatusProvider.analyzeProject()
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
