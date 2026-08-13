export { getLanguageService, getBlockArgumentCompletions } from "./language-service.js"
export { findTokenIndex, HerbHTMLNode } from "./herb-html-node.js"
export { buildHTMLDocument } from "./herb-html-document.js"
export { buildLineOffsetTable, positionToOffset, locationToOffsets } from "./offset-utils.js"

export type { OffsetRange } from "./offset-utils.js"
export type { AttributeSourceRange } from "./herb-html-node.js"
export type { LanguageServiceOptions } from "./types.js"

export {
  newHTMLDataProvider,
  getDefaultHTMLDataProvider,

  TokenType,
  ScannerState,
  ClientCapabilities,
  FileType,

  TextDocument,
  Position,
  Range,
  Location,
  MarkupContent,
  MarkupKind,
  MarkedString,
  SelectionRange,
  WorkspaceEdit,
  CompletionList,
  CompletionItemKind,
  CompletionItem,
  CompletionItemTag,
  InsertTextMode,
  Command,
  SymbolInformation,
  DocumentSymbol,
  SymbolKind,
  Hover,
  TextEdit,
  InsertReplaceEdit,
  InsertTextFormat,
  DocumentHighlight,
  DocumentHighlightKind,
  DocumentLink,
  FoldingRange,
  FoldingRangeKind,
  Diagnostic,
  FormattingOptions,
  Color,
  ColorInformation,
  ColorPresentation,
} from "vscode-html-languageservice"

export type {
  HTMLDocument,
  Node,
  LanguageService,
  Scanner,
  IHTMLDataProvider,
  ITagData,
  IAttributeData,
  IValueData,
  IReference,
  IValueSet,
  HTMLDataV1,
  CompletionConfiguration,
  HoverSettings,
  HTMLFormatConfiguration,
  DocumentContext,
  ICompletionParticipant,
  HtmlAttributeValueContext,
  HtmlContentContext,
  FileSystemProvider,
} from "vscode-html-languageservice"

export * from "./range_utils"
export * from "./root_element_collector"
export * from "./line_context_collector"
export * from "./parser_service"
export * from "./folding_range_provider"
export * from "./document_highlight_provider"
export * from "./inlay_hint_provider"
export * from "./node_labels"
export * from "./comment_ast_utils"
export * from "./comment_provider"
export * from "./hover_provider"
export * from "./rewrite_code_action_provider"
export * from "./extract_partial_analyzer"
export * from "./strict_locals_collector"
export * from "./ruby_locals_index"
export * from "./document_symbol_provider"
export * from "./uri"
export * from "./posix_path"
export * from "./extract_code_action_provider"
export * from "./render_collector"
export * from "./definition_provider"
export * from "./completion_provider"
export * from "./references_provider"
