import { ExtensionContext } from "vscode"
import { Client } from "./client"

let client: Client

export async function activate(context: ExtensionContext) {
  client = new Client(context)

  await client.start()

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Extension "herb-lsp" is now active!')
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop()
  } else {
    return undefined
  }
}
