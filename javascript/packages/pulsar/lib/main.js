const { AutoLanguageClient } = require("atom-languageclient")
const Convert = require("atom-languageclient/build/lib/convert").default
const cp = require("child_process")
const path = require("path")
const fs = require("fs")

class HerbLanguageClient extends AutoLanguageClient {
  getGrammarScopes() {
    return ["text.html.erb", "text.html.ruby"]
  }

  getLanguageName() {
    return "HTML+ERB"
  }

  getServerName() {
    return "Herb Language Server"
  }

  getServerPath() {
    const configPath = atom.config.get("ide-herb.serverPath")

    if (configPath) {
      return configPath
    }

    const bundled = path.join(__dirname, "..", "node_modules", ".bin", "herb-language-server")

    try {
      fs.accessSync(bundled, fs.constants.X_OK)
      return bundled
    } catch (_e) {
      return "herb-language-server"
    }
  }

  activate() {
    super.activate()

    this._disposable.add(
      atom.commands.add("atom-text-editor", {
        "herb:format-file": () => this.formatActiveEditor(),
      })
    )

    this._disposable.add(
      atom.workspace.observeTextEditors((editor) => {
        const disposable = editor.onDidSave(() => {
          if (!atom.config.get("ide-herb.formatterEnabled")) return
          if (!this.getGrammarScopes().includes(editor.getGrammar().scopeName)) return

          this.formatEditor(editor)
        })

        editor.onDidDestroy(() => disposable.dispose())
      })
    )
  }

  async formatActiveEditor() {
    const editor = atom.workspace.getActiveTextEditor()

    if (!editor) return

    await this.formatEditor(editor)
  }

  async formatEditor(editor) {
    const server = await this._serverManager.getServer(editor)

    if (!server || !server.capabilities.documentFormattingProvider) return

    const params = {
      textDocument: Convert.editorToTextDocumentIdentifier(editor),
      options: {
        tabSize: editor.getTabLength(),
        insertSpaces: editor.getSoftTabs(),
      },
    }

    const edits = await server.connection.documentFormatting(params)

    if (!edits || edits.length === 0) return

    editor.transact(() => {
      for (const edit of edits.reverse()) {
        const range = Convert.lsRangeToAtomRange(edit.range)
        editor.setTextInBufferRange(range, edit.newText)
      }
    })
  }

  startServerProcess(projectPath) {
    const serverPath = this.getServerPath()

    return cp.spawn(serverPath, ["--stdio"], {
      cwd: projectPath,
    })
  }

  preInitialization(connection) {
    connection.onCustomRequest("client/registerCapability", () => {
      return { registrations: [] }
    })

    connection.onCustomRequest("client/unregisterCapability", () => {
      return {}
    })

    connection.onTelemetryEvent((_event) => {
      // no-op: suppress unhandled telemetry events
    })
  }

  getInitializeParams(projectPath, lsProcess) {
    const params = super.getInitializeParams(projectPath, lsProcess)

    params.initializationOptions = {
      enabledFeatures: {
        diagnostics: atom.config.get("ide-herb.linterEnabled"),
      },
      formatter: {
        enabled: atom.config.get("ide-herb.formatterEnabled"),
      },
      experimentalFeaturesEnabled: false,
    }

    return params
  }
}

module.exports = new HerbLanguageClient()
