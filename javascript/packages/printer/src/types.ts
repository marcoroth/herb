export interface PrinterOptions {
  // Whitespace handling
  indentSize?: number
  indentChar?: ' ' | '\t'
  lineEnding?: '\n' | '\r\n'
  maxLineLength?: number

  // HTML specific
  selfClosingTagStyle?: '/>' | '>'
  attributeQuoteStyle?: 'double' | 'single' | 'auto'
  booleanAttributeStyle?: 'html' | 'xhtml'

  // ERB specific
  erbTagSpacing?: 'compact' | 'spaced'

  // Formatting behavior
  preserveWhitespace?: string[] // tags to preserve whitespace
  collapseWhitespace?: boolean
  trimTextNodes?: boolean
  collapseMultipleSpaces?: boolean
  collapseMultipleNewlines?: boolean
  preserveLineBreaks?: boolean

  // Pretty printing
  wrapAttributes?: 'auto' | 'force' | 'preserve'
  alignAttributes?: boolean
  insertFinalNewline?: boolean
}

export const DEFAULT_PRINTER_OPTIONS: PrinterOptions = {
  indentSize: 2,
  indentChar: ' ',
  lineEnding: '\n',
  maxLineLength: 80,
  selfClosingTagStyle: '/>',
  attributeQuoteStyle: 'double',
  booleanAttributeStyle: 'html',
  erbTagSpacing: 'spaced',
  preserveWhitespace: ['pre', 'code', 'script', 'style', 'textarea'],
  collapseWhitespace: false,
  trimTextNodes: false,
  collapseMultipleSpaces: false,
  collapseMultipleNewlines: false,
  preserveLineBreaks: true,
  wrapAttributes: 'auto',
  alignAttributes: false,
  insertFinalNewline: true
}
