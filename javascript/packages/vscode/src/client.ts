import * as path from "path"

import { workspace, ExtensionContext } from "vscode"
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node"

export class Client {
  private client: LanguageClient
  private serverModule: string
  private languageClientId = "languageServerHerb"
  private languageClientName = "Herb LSP "
  private context: ExtensionContext

  constructor(context: ExtensionContext) {
    this.context = context

    this.serverModule = this.context.asAbsolutePath(path.join("dist", "herb-language-server.js"))
    console.log(this.serverModule)

    this.client = new LanguageClient(
      this.languageClientId,
      this.languageClientName,
      this.serverOptions,
      this.clientOptions,
    )
  }

  async start() {
    try {
      await this.client.start()
    } catch (error: any) {
      console.error(`Error restarting the server: ${error.message}`)

      return
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop()
    }
  }

  async sendNotification(method: string, params: any) {
    return await this.client.sendNotification(method, params)
  }

  // The debug options for the server
  // --inspect=6010: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  private get debugOptions() {
    return {
      execArgv: ["--nolazy", "--inspect=6010"],
    }
  }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  private get serverOptions(): ServerOptions {
    return {
      run: {
        module: this.serverModule,
        transport: TransportKind.ipc,
      },
      debug: {
        module: this.serverModule,
        transport: TransportKind.ipc,
        options: this.debugOptions,
      },
    }
  }

  private get clientOptions(): LanguageClientOptions {
    return {
      documentSelector: [
        { scheme: "file", language: "erb" },
        { scheme: "file", language: "html" },
      ],
      synchronize: {
        // Notify the server about file changes to '.clientrc files contained in the workspace
        fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
      },
    }
  }
}
