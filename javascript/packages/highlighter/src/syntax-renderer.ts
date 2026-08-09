import { Token, RUBY_KEYWORDS } from "@herb-tools/core"
import { Herb } from "@herb-tools/node-wasm"
import { colorize } from "./color.js"

import type { HerbBackend } from "@herb-tools/core"
import type { Color } from "./color.js"
import type { ColorScheme } from "./themes.js"
import type { StyledRun, StyleRole } from "./document.js"

const HIGHLIGHTED_METHODS = ["raise"]
const HIGHLIGHTED_WORDS = new Set([...RUBY_KEYWORDS, ...HIGHLIGHTED_METHODS])

const PLAIN: StyleRole = { kind: "Plain" }

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
    return this.resolveRuns(this.highlightRuns(content))
  }

  public highlightRuns(content: string): StyledRun[] {
    if (!this.initialized || !this.herb) {
      throw new Error("SyntaxRenderer must be initialized before use. Call await initialize() first.")
    }

    const lexResult = this.herb.lex(content)

    if (lexResult.errors.length > 0) {
      return this.plainRuns(content)
    }

    const tokens = [...lexResult.value]

    return this.computeRuns(tokens, content)
  }

  private plainRuns(content: string): StyledRun[] {
    if (content.length === 0) {
      return []
    }

    return [{ text: content, role: PLAIN }]
  }

  private applyColor(text: string, color: Color | null): string {
    if (!this.isColorEnabled || !color) return text

    return colorize(text, color)
  }

  // TODO: in the future we should leverage Prism tokens here
  private rubyRuns(code: string): StyledRun[] {
    const words = code.split(/(\s+|[^\w\s]+)/)
    const runs: StyledRun[] = []

    for (const word of words) {
      if (word.length === 0) continue

      if (HIGHLIGHTED_WORDS.has(word)) {
        runs.push({ text: word, role: { kind: "RubyKeyword" } })
      } else {
        runs.push({ text: word, role: PLAIN })
      }
    }

    return runs
  }

  private computeRuns(tokens: Token[], content: string): StyledRun[] {
    if (!tokens || tokens.length === 0 || content.length === 0) {
      return this.plainRuns(content)
    }

    const runs: StyledRun[] = []
    let lastEnd = 0

    const state: SyntaxRenderState = {
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
        runs.push({ text: content.slice(lastEnd, token.range.start), role: PLAIN })
      }

      const tokenText = content.slice(token.range.start, token.range.end)

      this.updateState(state, token, tokenText, nextToken, prevToken)

      const role = this.getContextualRole(state, token, tokenText)

      if (token.type === "TOKEN_ERB_CONTENT") {
        runs.push(...this.rubyRuns(tokenText))
      } else {
        runs.push({ text: tokenText, role })
      }

      lastEnd = token.range.end
    }

    if (lastEnd < content.length) {
      runs.push({ text: content.slice(lastEnd), role: PLAIN })
    }

    return runs
  }

  private resolveRuns(runs: StyledRun[]): string {
    let resolved = ""

    for (const run of runs) {
      resolved += this.resolveRun(run)
    }

    return resolved
  }

  private resolveRun(run: StyledRun): string {
    const role = run.role

    switch (role.kind) {
      case "Plain":
        return run.text

      case "RubyKeyword":
        if (!this.isColorEnabled) return run.text

        return this.applyColor(run.text, this.colors.RUBY_KEYWORD)

      case "TagName":
        return this.applyColor(run.text, this.colors.TOKEN_HTML_TAG_START)

      case "AttributeName":
        return this.applyColor(run.text, "#D19A66")

      case "AttributeValue":
        return this.applyColor(run.text, "#98C379")

      case "CommentInterior":
        return this.applyColor(run.text, this.colors.TOKEN_HTML_COMMENT_START)

      case "Token": {
        if (!this.colors) {
          return run.text
        }

        const color = this.colors[role.tokenType as keyof ColorScheme]

        return this.applyColor(run.text, color !== undefined ? color : null)
      }
    }
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

  private getContextualRole(
    state: SyntaxRenderState,
    token: Token,
    tokenText: string,
  ): StyleRole {
    if (
      state.inComment &&
      token.type !== "TOKEN_HTML_COMMENT_START" &&
      token.type !== "TOKEN_HTML_COMMENT_END" &&
      token.type !== "TOKEN_ERB_START" &&
      token.type !== "TOKEN_ERB_CONTENT" &&
      token.type !== "TOKEN_ERB_END"
    ) {
      return { kind: "CommentInterior" }
    }

    switch (token.type) {
      case "TOKEN_IDENTIFIER":
        if (state.inTag && tokenText === state.tagName) {
          return { kind: "TagName" }
        } else if (
          state.inTag &&
          state.expectingAttributeValue &&
          !state.inQuotes
        ) {
          return { kind: "AttributeName" }
        } else if (state.inTag && state.expectingAttributeName) {
          return { kind: "AttributeName" }
        } else if (state.inTag && state.inQuotes) {
          return { kind: "AttributeValue" }
        } break

      case "TOKEN_QUOTE":
        if (state.inTag) {
          return { kind: "AttributeValue" }
        } break
    }

    return { kind: "Token", tokenType: token.type }
  }
}
