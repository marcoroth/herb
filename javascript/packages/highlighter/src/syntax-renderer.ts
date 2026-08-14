import { classifyTokens, splitRubyContent } from "@herb-tools/core"
import { Herb } from "@herb-tools/node-wasm"
import { colorize } from "./color.js"

import type { HerbBackend, ClassifiedToken, Token } from "@herb-tools/core"
import type { Color } from "./color.js"
import type { ColorScheme } from "./themes.js"

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

    return splitRubyContent(code)
      .map(fragment => fragment.keyword ? this.applyColor(fragment.text, this.colors.RUBY_KEYWORD) : fragment.text)
      .join("")
  }

  private highlightTokens(tokens: Token[], content: string): string {
    if (!tokens || tokens.length === 0) {
      return content
    }

    let highlighted = ""
    let lastEnd = 0

    for (const classified of classifyTokens(tokens, content)) {
      const { token } = classified

      if (token.range.start > lastEnd) {
        highlighted += content.slice(lastEnd, token.range.start)
      }

      const tokenText = content.slice(token.range.start, token.range.end)

      if (classified.category === "erb.content") {
        highlighted += this.highlightRubyCode(tokenText)
      } else {
        highlighted += this.applyColor(tokenText, this.colorFor(classified))
      }

      lastEnd = token.range.end
    }

    if (lastEnd < content.length) {
      highlighted += content.slice(lastEnd)
    }

    return highlighted
  }

  private colorFor({ token, category, quoted }: ClassifiedToken): Color | null {
    switch (category) {
      case "html.comment":
      case "erb.comment":
      case "erb.commentDelimiter":
        return this.colors.TOKEN_HTML_COMMENT_START

      case "html.tagName":
        return this.colors.TOKEN_HTML_TAG_START

      case "html.attributeName":
        return this.colors.HTML_ATTRIBUTE_NAME

      case "html.attributeValue":
        return quoted ? this.colors.TOKEN_QUOTE : this.colors.HTML_ATTRIBUTE_NAME
    }

    if (!this.colors) return null

    const color = this.colors[token.type as keyof ColorScheme]

    if (color === undefined || color === null) return null

    return typeof color === "string" ? color : null
  }
}
