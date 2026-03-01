import { Connection, TextDocuments, DocumentFormattingParams, DocumentRangeFormattingParams, TextEdit, Range, Position, TextDocumentSaveReason } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { Formatter, defaultFormatOptions } from "@herb-tools/formatter"
import { ASTRewriter, StringRewriter } from "@herb-tools/rewriter"
import { CustomRewriterLoader, builtinRewriters, isASTRewriterClass, isStringRewriterClass } from "@herb-tools/rewriter/loader"
import { Project } from "./project"
import { Settings } from "./settings"
import { Config } from "@herb-tools/config"
import { version } from "../package.json"

const OPEN_CONFIG_ACTION = 'Open .herb.yml'

export class FormattingService {
  private connection: Connection
  private documents: TextDocuments<TextDocument>
  private project: Project
  private settings: Settings
  private config?: Config
  private preRewriters: ASTRewriter[] = []
  private postRewriters: StringRewriter[] = []
  private failedRewriters: Map<string, string> = new Map()

  constructor(connection: Connection, documents: TextDocuments<TextDocument>, project: Project, settings: Settings) {
    this.connection = connection
    this.documents = documents
    this.project = project
    this.settings = settings
  }

  async initialize() {
    try {
      this.config = await Config.loadForEditor(this.project.projectPath, version)
      this.connection.console.log(`[Formatting] Config loaded, formatter config: ${JSON.stringify(this.config?.formatter || 'none')}`)
      await this.loadConfiguredRewriters()
      this.connection.console.log("Herb formatter initialized successfully")
    } catch (error) {
      this.connection.console.error(`Failed to initialize Herb formatter: ${error}`)
    }
  }

  async refreshConfig(config?: Config) {
    if (config) {
      this.config = config
    } else {
      try {
        this.config = await Config.loadForEditor(this.project.projectPath, version)
      } catch (error) {
        this.connection.console.error(`Failed to refresh Herb formatter config: ${error}`)
      }
    }

    await this.loadConfiguredRewriters()
  }

  private async loadConfiguredRewriters() {
    this.connection.console.log(`[Rewriter] Loading rewriters from config: ${JSON.stringify(this.config?.formatter?.rewriter || 'none')}`)

    this.failedRewriters.clear()

    if (!this.config?.formatter?.rewriter) {
      this.connection.console.log(`[Rewriter] No rewriter config found, clearing rewriters`)
      this.preRewriters = []
      this.postRewriters = []

      return
    }

    try {
      const baseDir = this.config.projectPath || this.project.projectPath
      this.connection.console.log(`[Rewriter] Using baseDir: ${baseDir}`)
      this.connection.console.log(`[Rewriter] config.projectPath: ${this.config.projectPath}`)
      this.connection.console.log(`[Rewriter] project.projectPath: ${this.project.projectPath}`)

      const preNames = this.config.formatter.rewriter.pre || []
      const postNames = this.config.formatter.rewriter.post || []
      const warnings: string[] = []
      const allRewriterClasses: any[] = []

      allRewriterClasses.push(...builtinRewriters)

      const loader = new CustomRewriterLoader({ baseDir })
      const { rewriters: customRewriters, duplicateWarnings } = await loader.loadRewritersWithInfo()

      allRewriterClasses.push(...customRewriters)
      warnings.push(...duplicateWarnings)

      const rewriterMap = new Map<string, any>()

      for (const RewriterClass of allRewriterClasses) {
        const instance = new RewriterClass()
        if (rewriterMap.has(instance.name)) {
          warnings.push(`Rewriter "${instance.name}" is defined multiple times. Using the last definition.`)
        }
        rewriterMap.set(instance.name, RewriterClass)
      }

      const preRewriters: ASTRewriter[] = []
      const postRewriters: StringRewriter[] = []

      for (const name of preNames) {
        const RewriterClass = rewriterMap.get(name)

        if (!RewriterClass) {
          warnings.push(`Pre-format rewriter "${name}" not found. Skipping.`)

          continue
        }

        if (!isASTRewriterClass(RewriterClass)) {
          warnings.push(`Rewriter "${name}" is not a pre-format rewriter. Skipping.`)

          continue
        }

        const instance = new RewriterClass()
        try {
          await instance.initialize({ baseDir })

          preRewriters.push(instance)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          warnings.push(`Failed to initialize pre-format rewriter "${name}": ${errorMessage}`)
          this.failedRewriters.set(name, errorMessage)
        }
      }

      for (const name of postNames) {
        const RewriterClass = rewriterMap.get(name)

        if (!RewriterClass) {
          warnings.push(`Post-format rewriter "${name}" not found. Skipping.`)

          continue
        }

        if (!isStringRewriterClass(RewriterClass)) {
          warnings.push(`Rewriter "${name}" is not a post-format rewriter. Skipping.`)

          continue
        }

        const instance = new RewriterClass()
        try {
          await instance.initialize({ baseDir })

          postRewriters.push(instance)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          warnings.push(`Failed to initialize post-format rewriter "${name}": ${errorMessage}`)
          this.failedRewriters.set(name, errorMessage)
        }
      }

      this.preRewriters = preRewriters
      this.postRewriters = postRewriters

      this.connection.console.log(`[Rewriter] Loaded ${preRewriters.length} pre-rewriters: ${preRewriters.map(r => r.name).join(', ')}`)
      this.connection.console.log(`[Rewriter] Loaded ${postRewriters.length} post-rewriters: ${postRewriters.map(r => r.name).join(', ')}`)

      if (warnings.length > 0) {
        // Log each warning individually
        warnings.forEach(warning => {
          this.connection.console.warn(`Rewriter: ${warning}`)
        })

        // Show a single combined warning message
        const message = warnings.length === 1
          ? `Herb Rewriter: ${warnings[0]}`
          : `Herb Rewriters (${warnings.length} failed):\n${warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}`

        if (this.settings.hasShowDocumentCapability) {
          this.connection.window.showWarningMessage(message, { title: OPEN_CONFIG_ACTION }).then(action => {
            if (action?.title === OPEN_CONFIG_ACTION) {
              const configPath = `${this.project.projectPath}/.herb.yml`
              this.connection.window.showDocument({ uri: `file://${configPath}`, takeFocus: true })
            }
          })
        } else {
          this.connection.window.showWarningMessage(message)
        }
      }
    } catch (error) {
      this.connection.console.error(`Failed to load rewriters: ${error}`)
      this.preRewriters = []
      this.postRewriters = []
    }
  }

  async formatOnSave(document: TextDocument, reason: TextDocumentSaveReason): Promise<TextEdit[]> {
    this.connection.console.log(`[Formatting] formatOnSave called for ${document.uri}`)

    if (reason !== TextDocumentSaveReason.Manual) {
      this.connection.console.log(`[Formatting] Skipping: reason=${reason} (not manual)`)

      return []
    }

    const filePath = document.uri.replace(/^file:\/\//, '')

    if (!this.shouldFormatFile(filePath)) {
      this.connection.console.log(`[Formatting] Skipping: file not in formatter config`)

      return []
    }

    return this.performFormatting({ textDocument: { uri: document.uri }, options: { tabSize: 2, insertSpaces: true } })
  }

  private shouldFormatFile(filePath: string): boolean {
    if (filePath.endsWith('.herb.yml')) return false
    if (!this.config) return true

    const hasConfigFile = Config.exists(this.config.projectPath)
    if (!hasConfigFile) return true

    const relativePath = filePath.replace('file://', '').replace(this.project.projectPath + '/', '')

    return this.config.isFormatterEnabledForPath(relativePath)
  }

  private async getConfigWithSettings(uri: string): Promise<Config | undefined> {
    const settings = await this.settings.getDocumentSettings(uri)

    if (!this.config) return undefined

    const projectFormatter = this.config.formatter || {}

    return {
      ...this.config,
      formatter: {
        ...projectFormatter,
        indentWidth: settings?.formatter?.indentWidth ?? projectFormatter.indentWidth,
        maxLineLength: settings?.formatter?.maxLineLength ?? projectFormatter.maxLineLength
      }
    } as Config
  }

  private async performFormatting(params: DocumentFormattingParams): Promise<TextEdit[]> {
    const document = this.documents.get(params.textDocument.uri)

    if (!document) {
      return []
    }

    try {
      const text = document.getText()
      const config = await this.getConfigWithSettings(params.textDocument.uri)

      this.connection.console.log(`[Formatting] Creating formatter with ${this.preRewriters.length} pre-rewriters, ${this.postRewriters.length} post-rewriters`)

      if (this.failedRewriters.size > 0) {
        const failedList = Array.from(this.failedRewriters.entries())
        const message = failedList.length === 1
          ? `Herb Rewriter "${failedList[0][0]}" is not available: ${failedList[0][1]}`
          : `Herb Rewriters (${failedList.length} not available):\n${failedList.map(([name, error], i) => `${i + 1}. ${name}: ${error}`).join('\n')}`

        if (this.settings.hasShowDocumentCapability) {
          this.connection.window.showWarningMessage(message, { title: OPEN_CONFIG_ACTION }).then(action => {
            if (action?.title === OPEN_CONFIG_ACTION) {
              const configPath = `${this.project.projectPath}/.herb.yml`
              this.connection.window.showDocument({ uri: `file://${configPath}`, takeFocus: true })
            }
          })
        } else {
          this.connection.window.showWarningMessage(message)
        }
      }

      const formatter = Formatter.from(this.project.herbBackend, config, {
        preRewriters: this.preRewriters,
        postRewriters: this.postRewriters
      })

      let newText = formatter.format(text)

      if (!newText.endsWith('\n')) {
        newText = newText + '\n'
      }

      if (newText === text) {
        return []
      }

      const range: Range = {
        start: Position.create(0, 0),
        end: Position.create(document.lineCount, 0)
      }

      return [{ range, newText }]
    } catch (error) {
      this.connection.console.error(`Formatting failed: ${error}`)

      return []
    }
  }

  async formatDocument(params: DocumentFormattingParams): Promise<TextEdit[]> {
    if (params.textDocument.uri.endsWith('.herb.yml')) {
      return []
    }

    const settings = await this.settings.getDocumentSettings(params.textDocument.uri)

    if (settings?.formatter?.enabled === false) {
      return []
    }

    const filePath = params.textDocument.uri.replace(/^file:\/\//, '')

    if (!this.shouldFormatFile(filePath)) {
      return []
    }

    return this.performFormatting(params)
  }

  async formatDocumentIgnoreConfig(params: DocumentFormattingParams): Promise<TextEdit[]> {
    return this.performFormatting(params)
  }

  private async performRangeFormatting(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    const document = this.documents.get(params.textDocument.uri)

    if (!document) {
      return []
    }

    try {
      const config = await this.getConfigWithSettings(params.textDocument.uri)
      const formatter = Formatter.from(this.project.herbBackend, config, {
        preRewriters: this.preRewriters,
        postRewriters: this.postRewriters
      })

      const rangeText = document.getText(params.range)
      const lines = rangeText.split('\n')

      let minIndentLevel = Infinity
      const indentWidth = config?.formatter?.indentWidth ?? defaultFormatOptions.indentWidth

      for (const line of lines) {
        const trimmedLine = line.trim()

        if (trimmedLine !== '') {
          const indent = line.match(/^\s*/)?.[0] || ''
          const indentLevel = Math.floor(indent.length / indentWidth)

          minIndentLevel = Math.min(minIndentLevel, indentLevel)
        }
      }

      if (minIndentLevel === Infinity) {
        minIndentLevel = 0
      }

      let textToFormat = rangeText

      if (minIndentLevel > 0) {
        const minIndentString = ' '.repeat(minIndentLevel * indentWidth)

        textToFormat = lines.map(line => {
          if (line.trim() === '') {
            return line
          }

          return line.startsWith(minIndentString) ? line.slice(minIndentString.length) : line
        }).join('\n')
      }

      let formattedText = formatter.format(textToFormat)

      if (minIndentLevel > 0) {
        const formattedLines = formattedText.split('\n')
        const indentString = ' '.repeat(minIndentLevel * indentWidth)

        formattedText = formattedLines.map((line: string, _index: number) => {
          if (line.trim() === '') {
            return line
          }

          return indentString + line
        }).join('\n')
      }

      if (formattedText === rangeText) {
        return []
      }

      return [{ range: params.range, newText: formattedText }]
    } catch (error) {
      this.connection.console.error(`Range formatting failed: ${error}`)

      return []
    }
  }

  async formatRange(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    if (params.textDocument.uri.endsWith('.herb.yml')) {
      return []
    }

    const filePath = params.textDocument.uri.replace(/^file:\/\//, '')

    if (!this.shouldFormatFile(filePath)) {
      return []
    }

    return this.performRangeFormatting(params)
  }

  async formatRangeIgnoreConfig(params: DocumentRangeFormattingParams): Promise<TextEdit[]> {
    return this.performRangeFormatting(params)
  }
}
