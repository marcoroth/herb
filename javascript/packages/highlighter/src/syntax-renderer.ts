import { Token } from "@herb-tools/core"
import { Herb } from "@herb-tools/node-wasm"
import { colorize } from "./color.js"

import type { HerbBackend } from "@herb-tools/core"
import type { Color } from "./color.js"
import type { ColorScheme } from "./themes.js"

type SyntaxRenderState = {
  inTag: boolean
  inQuotes: boolean
  quoteChar: string
  tagName: string
  isClosingTag: boolean
  expectingAttributeName: boolean
  expectingAttributeValue: boolean
  inComment: boolean
}

export class SyntaxRenderer {
  private colors: ColorScheme
  private isColorEnabled: boolean
  private herb: HerbBackend

  public constructor(colors: ColorScheme, herb?: HerbBackend) {
    this.colors = colors
    this.isColorEnabled = process.env.NO_COLOR === undefined
    this.herb = herb || Herb
  }

  public async initialize(): Promise<void> {
    if (this.herb.isLoaded) {
      return
    }

    await this.herb.load()
  }

  public get initialized(): boolean {
    return this.herb.isLoaded
  }

  public highlight(content: string): string {
    if (!this.initialized || !this.herb) {
      throw new Error("SyntaxRenderer must be initialized before use. Call await initialize() first.")
    }

    const lexResult = this.herb.lex(content)

    if (lexResult.errors.length > 0) {
      return content
    }

    const tokens = [...lexResult.value]

    return this.highlightTokens(tokens, content)
  }

  private applyColor(text: string, color: Color | null): string {
    if (!this.isColorEnabled || !color) return text

    return colorize(text, color)
  }

  // TODO: in the future we should leverage Prism tokens here
  private highlightRubyCode(code: string): string {
    if (!this.isColorEnabled) return code

    const words = code.split(/(\s+|[^\w\s]+)/)
    const keywords = [
      "if",
      "unless",
      "else",
      "elsif",
      "end",
      "def",
      "class",
      "module",
      "return",
      "yield",
      "break",
      "next",
      "case",
      "when",
      "then",
      "while",
      "until",
      "for",
      "in",
      "do",
      "begin",
      "rescue",
      "ensure",
      "retry",
      "raise",
      "super",
      "self",
      "nil",
      "true",
      "false",
      "and",
      "or",
      "not",
    ]

    return words
      .map((word) => {
        if (keywords.includes(word)) {
          return this.applyColor(word, this.colors.RUBY_KEYWORD)
        }

        return word
      }).join("")
  }

  private highlightTokens(tokens: Token[], content: string): string {
    if (!tokens || tokens.length === 0) {
      return content
    }

    let highlighted = ""
    let lastEnd = 0

    let state: SyntaxRenderState = {
      inTag: false,
      inQuotes: false,
      quoteChar: "",
      tagName: "",
      isClosingTag: false,
      expectingAttributeName: false,
      expectingAttributeValue: false,
      inComment: false,
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const nextToken = tokens[i + 1]
      const prevToken = tokens[i - 1]

      if (token.range.start > lastEnd) {
        highlighted += content.slice(lastEnd, token.range.start)
      }

      const tokenText = content.slice(token.range.start, token.range.end)

      this.updateState(state, token, tokenText, nextToken, prevToken)

      const color = this.getContextualColor(state, token, tokenText)

      if (token.type === "TOKEN_ERB_CONTENT") {
        const highlightedRuby = this.highlightRubyCode(tokenText)
        highlighted += highlightedRuby
      } else if (color !== undefined) {
        highlighted += this.applyColor(tokenText, color)
      } else {
        highlighted += tokenText
      }

      lastEnd = token.range.end
    }

    if (lastEnd < content.length) {
      highlighted += content.slice(lastEnd)
    }

    return highlighted
  }

  private updateState(
    state: SyntaxRenderState,
    token: Token,
    tokenText: string,
    _nextToken?: Token,
    _prevToken?: Token,
  ) {
    switch (token.type) {
      case "TOKEN_HTML_TAG_START":
        state.inTag = true
        state.isClosingTag = false
        state.expectingAttributeName = false
        state.expectingAttributeValue = false
        break

      case "TOKEN_HTML_TAG_START_CLOSE":
        state.inTag = true
        state.isClosingTag = true
        state.expectingAttributeName = false
        state.expectingAttributeValue = false
        break

      case "TOKEN_HTML_TAG_END":
      case "TOKEN_HTML_TAG_SELF_CLOSE":
        state.inTag = false
        state.tagName = ""
        state.isClosingTag = false
        state.expectingAttributeName = false
        state.expectingAttributeValue = false
        break

      case "TOKEN_IDENTIFIER":
        if (state.inTag && !state.tagName) {
          state.tagName = tokenText
          state.expectingAttributeName = !state.isClosingTag
        } else if (state.inTag && state.expectingAttributeName) {
          state.expectingAttributeName = false
          state.expectingAttributeValue = true
        } break

      case "TOKEN_EQUALS":
        if (state.inTag) {
          state.expectingAttributeValue = true
        } break

      case "TOKEN_QUOTE":
        if (state.inTag) {
          if (!state.inQuotes) {
            state.inQuotes = true
            state.quoteChar = tokenText
          } else if (tokenText === state.quoteChar) {
            state.inQuotes = false
            state.quoteChar = ""
            state.expectingAttributeName = true
            state.expectingAttributeValue = false
          }
        } break

      case "TOKEN_WHITESPACE":
        if (state.inTag && !state.inQuotes && state.tagName) {
          state.expectingAttributeName = true
          state.expectingAttributeValue = false
        } break

      case "TOKEN_HTML_COMMENT_START":
        state.inComment = true
        break

      case "TOKEN_HTML_COMMENT_END":
        state.inComment = false
        break
    }
  }

  private getContextualColor(
    state: SyntaxRenderState,
    token: Token,
    tokenText: string,
  ): Color | null {
    if (
      state.inComment &&
      token.type !== "TOKEN_HTML_COMMENT_START" &&
      token.type !== "TOKEN_HTML_COMMENT_END" &&
      token.type !== "TOKEN_ERB_START" &&
      token.type !== "TOKEN_ERB_CONTENT" &&
      token.type !== "TOKEN_ERB_END"
    ) {
      return this.colors.TOKEN_HTML_COMMENT_START
    }

    switch (token.type) {
      case "TOKEN_IDENTIFIER":
        if (state.inTag && tokenText === state.tagName) {
          return this.colors.TOKEN_HTML_TAG_START
        } else if (
          state.inTag &&
          state.expectingAttributeValue &&
          !state.inQuotes
        ) {
          return "#D19A66"
        } else if (state.inTag && state.expectingAttributeName) {
          return "#D19A66"
        } else if (state.inTag && state.inQuotes) {
          return "#98C379"
        } break

      case "TOKEN_QUOTE":
        if (state.inTag) {
          return "#98C379"
        } break
    }

    if (!this.colors) {
      return null
    }
    
    const color = this.colors[token.type as keyof ColorScheme]
    return color !== undefined ? color : null
  }
}
