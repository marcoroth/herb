import * as path from "path"

import { workspace, ExtensionContext, Disposable, window } from "vscode"
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node"
import { Config } from "@herb-tools/config"

export class Client {
  private client!: LanguageClient
  private serverModule: string
  private languageClientId = "languageServerHerb"
  private languageClientName = "Herb Language Server "
  private context: ExtensionContext
  private configurationListener?: Disposable
  private outputChannel = window.createOutputChannel("Herb Language Server")

  constructor(context: ExtensionContext) {
    this.context = context
    this.serverModule = this.context.asAbsolutePath(path.join("dist", "herb-language-server.js"))
    console.log(this.serverModule)
  }

  async start() {
    try {
      const clientOptions = await this.getClientOptions()

      this.client = new LanguageClient(
        this.languageClientId,
        this.languageClientName,
        this.serverOptions,
        clientOptions,
      )

      await this.client.start()
      this.setupConfigurationListener()
    } catch (error: any) {
      console.error(`Error restarting the server: ${error.message}`)

      return
    }
  }

  private setupConfigurationListener() {
    this.configurationListener = workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('languageServerHerb')) {
        console.log("Herb configuration changed, updating...")
        await this.updateConfiguration()
      }
    })

    this.context.subscriptions.push(this.configurationListener)
  }

  async stop(): Promise<void> {
    if (this.configurationListener) {
      this.configurationListener.dispose()
      this.configurationListener = undefined
    }

    if (this.client) {
      await this.client.stop()
    }
  }

  async sendNotification(method: string, params: any) {
    return await this.client.sendNotification(method, params)
  }

  async updateConfiguration() {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath
    let settings: any

    if (workspaceRoot) {
      try {
        const projectConfig = await Config.loadForEditor(workspaceRoot)
        const vscodeConfig = workspace.getConfiguration('languageServerHerb')

        settings = {
          linter: {
            enabled: projectConfig.linter?.enabled ?? true
          },
          formatter: {
            enabled: projectConfig.formatter?.enabled ?? vscodeConfig.get('formatter.enabled', false),
            indentWidth: projectConfig.formatter?.indentWidth ?? 2,
            maxLineLength: projectConfig.formatter?.maxLineLength ?? 80,
            exclude: projectConfig.formatter?.exclude,
            rewriter: projectConfig.formatter?.rewriter,
          },
          trace: {
            server: vscodeConfig.get('trace.server', 'verbose'),
          },
        }
      } catch (_error) {
        const vscodeConfig = workspace.getConfiguration('languageServerHerb')

        settings = {
          linter: {
            enabled: vscodeConfig.get('linter.enabled', true)
          },
          formatter: {
            enabled: vscodeConfig.get('formatter.enabled', false),
            indentWidth: vscodeConfig.get('formatter.indentWidth', 2),
            maxLineLength: vscodeConfig.get('formatter.maxLineLength', 80),
          },
          trace: {
            server: vscodeConfig.get('trace.server', 'verbose'),
          },
        }
      }
    } else {
      settings = {
        linter: { enabled: true },
        formatter: { enabled: false, indentWidth: 2, maxLineLength: 80 },
        trace: { server: 'verbose' },
      }
    }

    await this.client.sendNotification('workspace/didChangeConfiguration', {
      settings: { languageServerHerb: settings }
    })
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

  private async getClientOptions(): Promise<LanguageClientOptions> {
    return {
      documentSelector: [
        { scheme: "file", language: "erb" },
        { scheme: "file", language: "html" },
        { scheme: "file", language: "yaml", pattern: "**/.herb.yml" },
      ],
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
        configurationSection: 'languageServerHerb',
      },
      initializationOptions: await this.getInitializationOptions(),
      outputChannel: this.outputChannel,
    }
  }

  private async getInitializationOptions() {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath

    if (workspaceRoot) {
      try {
        const projectConfig = await Config.loadForEditor(workspaceRoot)
        const vscodeConfig = workspace.getConfiguration('languageServerHerb')

        return {
          linter: {
            enabled: projectConfig.linter?.enabled ?? true
          },
          formatter: {
            enabled: projectConfig.formatter?.enabled ?? vscodeConfig.get('formatter.enabled', false),
            indentWidth: projectConfig.formatter?.indentWidth ?? 2,
            maxLineLength: projectConfig.formatter?.maxLineLength ?? 80,
            exclude: projectConfig.formatter?.exclude,
            rewriter: projectConfig.formatter?.rewriter,
          },
          trace: {
            server: vscodeConfig.get('trace.server', 'verbose'), // Trace is always from VS Code
          },
        }
      } catch (_error) {
        const vscodeConfig = workspace.getConfiguration('languageServerHerb')

        return {
          linter: {
            enabled: vscodeConfig.get('linter.enabled', true)
          },
          formatter: {
            enabled: vscodeConfig.get('formatter.enabled', false),
            indentWidth: vscodeConfig.get('formatter.indentWidth', 2),
            maxLineLength: vscodeConfig.get('formatter.maxLineLength', 80),
          },
          trace: {
            server: vscodeConfig.get('trace.server', 'verbose'),
          },
        }
      }
    } else {
      return {
        linter: { enabled: true },
        formatter: { enabled: false, indentWidth: 2, maxLineLength: 80 },
        trace: { server: 'verbose' },
      }
    }
  }
}
