import type { Color } from './color.js'

export type Theme = 'default' | 'bright' | 'pastel'

export interface ColorScheme {
  // Whitespace and special characters
  TOKEN_WHITESPACE: Color | null
  TOKEN_NBSP: Color | null
  TOKEN_NEWLINE: Color | null
  TOKEN_IDENTIFIER: Color

  // Ruby syntax highlighting colors
  RUBY_KEYWORD: Color

  // HTML DOCTYPE
  TOKEN_HTML_DOCTYPE: Color

  // HTML Tags
  TOKEN_HTML_TAG_START: Color
  TOKEN_HTML_TAG_START_CLOSE: Color
  TOKEN_HTML_TAG_END: Color
  TOKEN_HTML_TAG_SELF_CLOSE: Color

  // HTML Comments
  TOKEN_HTML_COMMENT_START: Color
  TOKEN_HTML_COMMENT_END: Color

  // ERB Tags
  TOKEN_ERB_START: Color
  TOKEN_ERB_CONTENT: Color
  TOKEN_ERB_END: Color

  // Punctuation and symbols
  TOKEN_LT: Color
  TOKEN_SLASH: Color
  TOKEN_EQUALS: Color
  TOKEN_QUOTE: Color
  TOKEN_DASH: Color
  TOKEN_UNDERSCORE: Color
  TOKEN_EXCLAMATION: Color
  TOKEN_SEMICOLON: Color
  TOKEN_COLON: Color
  TOKEN_PERCENT: Color
  TOKEN_AMPERSAND: Color

  // Special tokens
  TOKEN_CHARACTER: Color
  TOKEN_ERROR: Color
  TOKEN_EOF: Color | null
}

export const themes: Record<Theme, ColorScheme> = {
  default: {
    // Whitespace and special characters
    TOKEN_WHITESPACE: null,
    TOKEN_NBSP: '#5C6370', // OneDark comment gray
    TOKEN_NEWLINE: null,
    TOKEN_IDENTIFIER: '#ABB2BF', // OneDark foreground

    // Ruby syntax highlighting colors
    RUBY_KEYWORD: '#C678DD', // OneDark purple for keywords

    // HTML DOCTYPE
    TOKEN_HTML_DOCTYPE: '#61AFEF', // OneDark function blue

    // HTML Tags
    TOKEN_HTML_TAG_START: '#E06C75', // OneDark tag names (red)
    TOKEN_HTML_TAG_START_CLOSE: '#E06C75',
    TOKEN_HTML_TAG_END: '#E06C75',
    TOKEN_HTML_TAG_SELF_CLOSE: '#E06C75',

    // HTML Comments
    TOKEN_HTML_COMMENT_START: '#5C6370', // OneDark comments
    TOKEN_HTML_COMMENT_END: '#5C6370',

    // ERB Tags
    TOKEN_ERB_START: '#BE5046', // OneDark punctuation section embedded
    TOKEN_ERB_CONTENT: '#E5C07B', // OneDark entity name type (yellow)
    TOKEN_ERB_END: '#BE5046',

    // Punctuation and symbols
    TOKEN_LT: '#E06C75', // OneDark tag related
    TOKEN_SLASH: '#E06C75',
    TOKEN_EQUALS: '#56B6C2', // OneDark operators (cyan)
    TOKEN_QUOTE: '#98C379', // OneDark strings (green)
    TOKEN_DASH: '#ABB2BF', // OneDark foreground
    TOKEN_UNDERSCORE: '#ABB2BF',
    TOKEN_EXCLAMATION: '#C678DD', // OneDark keywords (purple)
    TOKEN_SEMICOLON: '#ABB2BF',
    TOKEN_COLON: '#ABB2BF',
    TOKEN_PERCENT: '#BE5046', // OneDark ERB related
    TOKEN_AMPERSAND: '#D19A66', // OneDark constants (orange)

    // Special tokens
    TOKEN_CHARACTER: '#ABB2BF', // OneDark foreground
    TOKEN_ERROR: '#E05252', // OneDark invalid illegal
    TOKEN_EOF: null
  },

  bright: {
    // Whitespace and special characters
    TOKEN_WHITESPACE: null,
    TOKEN_NBSP: 'gray',
    TOKEN_NEWLINE: null,
    TOKEN_IDENTIFIER: 'white',

    // Ruby syntax highlighting colors
    RUBY_KEYWORD: 'brightRed', // Bright red for keywords

    // HTML DOCTYPE
    TOKEN_HTML_DOCTYPE: 'brightBlue',

    // HTML Tags
    TOKEN_HTML_TAG_START: 'brightBlue',
    TOKEN_HTML_TAG_START_CLOSE: 'brightBlue',
    TOKEN_HTML_TAG_END: 'brightBlue',
    TOKEN_HTML_TAG_SELF_CLOSE: 'brightBlue',

    // HTML Comments
    TOKEN_HTML_COMMENT_START: 'gray',
    TOKEN_HTML_COMMENT_END: 'gray',

    // ERB Tags
    TOKEN_ERB_START: 'brightMagenta',
    TOKEN_ERB_CONTENT: 'brightYellow',
    TOKEN_ERB_END: 'brightMagenta',

    // Punctuation and symbols
    TOKEN_LT: 'brightBlue',
    TOKEN_SLASH: 'brightBlue',
    TOKEN_EQUALS: 'brightCyan',
    TOKEN_QUOTE: 'brightGreen',
    TOKEN_DASH: 'white',
    TOKEN_UNDERSCORE: 'white',
    TOKEN_EXCLAMATION: 'brightRed',
    TOKEN_SEMICOLON: 'white',
    TOKEN_COLON: 'white',
    TOKEN_PERCENT: 'brightMagenta',
    TOKEN_AMPERSAND: 'brightYellow',

    // Special tokens
    TOKEN_CHARACTER: 'white',
    TOKEN_ERROR: 'brightRed',
    TOKEN_EOF: null
  },

  pastel: {
    // Whitespace and special characters
    TOKEN_WHITESPACE: null,
    TOKEN_NBSP: 'gray',
    TOKEN_NEWLINE: null,
    TOKEN_IDENTIFIER: 'green',

    // Ruby syntax highlighting colors
    RUBY_KEYWORD: 'red', // Red for keywords

    // HTML DOCTYPE
    TOKEN_HTML_DOCTYPE: 'cyan',

    // HTML Tags
    TOKEN_HTML_TAG_START: 'cyan',
    TOKEN_HTML_TAG_START_CLOSE: 'cyan',
    TOKEN_HTML_TAG_END: 'cyan',
    TOKEN_HTML_TAG_SELF_CLOSE: 'cyan',

    // HTML Comments
    TOKEN_HTML_COMMENT_START: 'gray',
    TOKEN_HTML_COMMENT_END: 'gray',

    // ERB Tags
    TOKEN_ERB_START: 'magenta',
    TOKEN_ERB_CONTENT: 'yellow',
    TOKEN_ERB_END: 'magenta',

    // Punctuation and symbols
    TOKEN_LT: 'cyan',
    TOKEN_SLASH: 'cyan',
    TOKEN_EQUALS: 'blue',
    TOKEN_QUOTE: 'green',
    TOKEN_DASH: 'white',
    TOKEN_UNDERSCORE: 'white',
    TOKEN_EXCLAMATION: 'red',
    TOKEN_SEMICOLON: 'white',
    TOKEN_COLON: 'white',
    TOKEN_PERCENT: 'magenta',
    TOKEN_AMPERSAND: 'yellow',

    // Special tokens
    TOKEN_CHARACTER: 'green',
    TOKEN_ERROR: 'red',
    TOKEN_EOF: null
  }
}
