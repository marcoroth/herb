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

  console.log("Herb LSP is now active!")
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
