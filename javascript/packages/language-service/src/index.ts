export { getLanguageService } from "./language-service.js"
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
