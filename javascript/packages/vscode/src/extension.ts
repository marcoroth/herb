import { ExtensionContext } from "vscode"
import { Client } from "./client"

let client: Client

export async function activate(context: ExtensionContext) {
  console.log("Activating Herb LSP...")

  client = new Client(context)

  await client.start()

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
