import {
  languages,
  Range as MonacoRange,
} from "monaco-editor/esm/vs/editor/edcore.main.js"

import {
  ParserService,
  HoverProvider,
  CompletionProvider,
  FoldingRangeProvider,
  DocumentSymbolProvider,
  DocumentHighlightProvider,
  RewriteCodeActionProvider,
  TextDocument,
  CompletionItemKind,
  SymbolKind,
  DocumentHighlightKind,
  InsertTextFormat,
} from "@herb-tools/language-service"

const LANGUAGE_ID = "erb"
const DOCUMENT_URI = "file:///playground.html.erb"
const BASE_DIR = "/"
const PARSE_CACHE_LIMIT = 12

const TRIGGER_CHARACTERS = [".", ":", "<", "&", '"', "'", "/", ",", " ", "@"]
const REWRITE_CODE_ACTION_KIND = "refactor.rewrite"

function kindsByName(lspKind, monacoKind) {
  const mapping = new Map()

  for (const [name, value] of Object.entries(lspKind)) {
    if (typeof value !== "number") continue
    if (typeof monacoKind[name] !== "number") continue

    mapping.set(value, monacoKind[name])
  }

  return mapping
}

const COMPLETION_KINDS = kindsByName(CompletionItemKind, languages.CompletionItemKind)
const SYMBOL_KINDS = kindsByName(SymbolKind, languages.SymbolKind)
const HIGHLIGHT_KINDS = kindsByName(DocumentHighlightKind, languages.DocumentHighlightKind)

const FOLDING_KINDS = {
  comment: languages.FoldingRangeKind.Comment,
  imports: languages.FoldingRangeKind.Imports,
  region: languages.FoldingRangeKind.Region,
}

function lspPosition(position) {
  return { line: position.lineNumber - 1, character: position.column - 1 }
}

function monacoRange(range) {
  return new MonacoRange(
    range.start.line + 1,
    range.start.character + 1,
    range.end.line + 1,
    range.end.character + 1,
  )
}

function lspRange(range) {
  return {
    start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
    end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
  }
}

function codeActionFor(action, model) {
  const changes = action.edit?.changes ?? {}

  const edits = Object.values(changes).flat().map(edit => ({
    resource: model.uri,
    versionId: undefined,
    textEdit: { range: monacoRange(edit.range), text: edit.newText },
  }))

  return {
    title: action.title,
    kind: action.kind,
    isPreferred: action.isPreferred,
    edit: { edits },
  }
}

function documentFor(model) {
  return TextDocument.create(
    DOCUMENT_URI,
    LANGUAGE_ID,
    model.getVersionId(),
    model.getValue(),
  )
}

function markdownFor(contents) {
  if (contents === null || contents === undefined) return []
  if (typeof contents === "string") return [{ value: contents }]
  if (Array.isArray(contents)) return contents.flatMap(markdownFor)
  if (typeof contents.kind === "string") return [{ value: contents.value }]

  return [{ value: `\`\`\`${contents.language}\n${contents.value}\n\`\`\`` }]
}

function completionItemFor(item, fallbackRange) {
  const edit = item.textEdit

  return {
    label: item.label,
    kind: COMPLETION_KINDS.get(item.kind) ?? languages.CompletionItemKind.Text,
    detail: item.detail,
    documentation: markdownFor(item.documentation)[0],
    insertText: edit?.newText ?? item.insertText ?? item.label,
    insertTextRules:
      item.insertTextFormat === InsertTextFormat.Snippet
        ? languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
    filterText: item.filterText,
    sortText: item.sortText,
    range: edit ? monacoRange(edit.range ?? edit.replace) : fallbackRange,
  }
}

function documentSymbolFor(symbol) {
  return {
    name: symbol.name,
    detail: symbol.detail ?? "",
    kind: SYMBOL_KINDS.get(symbol.kind) ?? languages.SymbolKind.Variable,
    tags: symbol.tags ?? [],
    range: monacoRange(symbol.range),
    selectionRange: monacoRange(symbol.selectionRange),
    children: (symbol.children ?? []).map(documentSymbolFor),
  }
}

function safely(operation, fallback) {
  try {
    return operation()
  } catch (error) {
    console.error("[herb language service]", error)

    return fallback
  }
}

class CachingParserService extends ParserService {
  #cache = new Map()

  #remember(key, compute) {
    if (this.#cache.has(key)) {
      const cached = this.#cache.get(key)

      this.#cache.delete(key)
      this.#cache.set(key, cached)

      return cached
    }

    const value = compute()

    this.#cache.set(key, value)

    if (this.#cache.size > PARSE_CACHE_LIMIT) {
      this.#cache.delete(this.#cache.keys().next().value)
    }

    return value
  }

  parseDocument(textDocument) {
    return this.#remember(
      `document ${textDocument.getText()}`,
      () => super.parseDocument(textDocument),
    )
  }
}

export function createLanguageService(herb) {
  const parserService = new CachingParserService(herb)

  return {
    hover: new HoverProvider(parserService, BASE_DIR),
    completion: new CompletionProvider(parserService),
    folding: new FoldingRangeProvider(parserService),
    symbols: new DocumentSymbolProvider(parserService),
    highlights: new DocumentHighlightProvider(parserService),
    rewriteCodeActions: new RewriteCodeActionProvider(parserService, BASE_DIR),
  }
}

export function registerLanguageService(herb) {
  const service = createLanguageService(herb)

  const disposables = [
    languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover(model, position) {
        return safely(() => {
          const hover = service.hover.getHover(documentFor(model), lspPosition(position))

          if (!hover) return null

          return {
            contents: markdownFor(hover.contents),
            range: hover.range ? monacoRange(hover.range) : undefined,
          }
        }, null)
      },
    }),

    languages.registerCompletionItemProvider(LANGUAGE_ID, {
      triggerCharacters: TRIGGER_CHARACTERS,

      provideCompletionItems(model, position) {
        return safely(() => {
          const list = service.completion.getCompletions(
            documentFor(model),
            lspPosition(position),
          )

          if (!list) return { suggestions: [] }

          const word = model.getWordUntilPosition(position)

          const fallbackRange = new MonacoRange(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          )

          return {
            incomplete: list.isIncomplete,
            suggestions: list.items.map(item => completionItemFor(item, fallbackRange)),
          }
        }, { suggestions: [] })
      },
    }),

    languages.registerFoldingRangeProvider(LANGUAGE_ID, {
      provideFoldingRanges(model) {
        return safely(() =>
          service.folding.getFoldingRanges(documentFor(model)).map(range => ({
            start: range.startLine + 1,
            end: range.endLine + 1,
            kind: FOLDING_KINDS[range.kind],
          })), [])
      },
    }),

    languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
      displayName: "Herb",

      provideDocumentSymbols(model) {
        return safely(() =>
          service.symbols.getDocumentSymbols(documentFor(model)).map(documentSymbolFor), [])
      },
    }),

    languages.registerCodeActionProvider(LANGUAGE_ID, {
      providedCodeActionKinds: [REWRITE_CODE_ACTION_KIND],

      provideCodeActions(model, range) {
        return safely(() => {
          const actions = service.rewriteCodeActions.getCodeActions(
            documentFor(model),
            lspRange(range),
          )

          return {
            actions: actions.map(action => codeActionFor(action, model)),
            dispose() {},
          }
        }, { actions: [], dispose() {} })
      },
    }),

    languages.registerDocumentHighlightProvider(LANGUAGE_ID, {
      provideDocumentHighlights(model, position) {
        return safely(() =>
          service.highlights
            .getDocumentHighlights(documentFor(model), lspPosition(position))
            .map(highlight => ({
              range: monacoRange(highlight.range),
              kind: HIGHLIGHT_KINDS.get(highlight.kind),
            })), [])
      },
    }),
  ]

  return {
    providers: service,

    setFramework(framework) {
      service.completion.setFramework(framework)
    },

    dispose() {
      disposables.forEach(disposable => disposable.dispose())
    },
  }
}
