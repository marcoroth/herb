import { RUBY_KEYWORDS } from "./ruby-keywords.js"

import type { Token } from "./token.js"

export type TokenCategory =
  | "html.tagName"
  | "html.attributeName"
  | "html.attributeValue"
  | "html.delimiter"
  | "html.comment"
  | "html.doctype"
  | "html.entity"
  | "erb.delimiter"
  | "erb.content"
  | "erb.commentDelimiter"
  | "erb.comment"
  | "other"

export interface ClassifiedToken {
  token: Token
  category: TokenCategory
  quoted?: boolean
  output?: boolean
}

interface ClassifierState {
  inTag: boolean
  inQuotes: boolean
  quoteCharacter: string
  tagName: string
  isClosingTag: boolean
  expectingAttributeName: boolean
  expectingAttributeValue: boolean
  inComment: boolean
  inERBComment: boolean
  inERBOutput: boolean
}

const HTML_DELIMITERS = new Set([
  "TOKEN_HTML_TAG_START",
  "TOKEN_HTML_TAG_START_CLOSE",
  "TOKEN_HTML_TAG_END",
  "TOKEN_HTML_TAG_SELF_CLOSE",
])

const ERB_DELIMITERS = new Set(["TOKEN_ERB_START", "TOKEN_ERB_END"])
const COMMENT_DELIMITERS = new Set(["TOKEN_HTML_COMMENT_START", "TOKEN_HTML_COMMENT_END"])
const ERB_TOKENS = new Set([...ERB_DELIMITERS, "TOKEN_ERB_CONTENT"])

function initialState(): ClassifierState {
  return {
    inTag: false,
    inQuotes: false,
    quoteCharacter: "",
    tagName: "",
    isClosingTag: false,
    expectingAttributeName: false,
    expectingAttributeValue: false,
    inComment: false,
    inERBComment: false,
    inERBOutput: false,
  }
}

function advance(state: ClassifierState, token: Token, text: string): void {
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
        state.tagName = text
        state.expectingAttributeName = !state.isClosingTag
      } else if (state.inTag && state.expectingAttributeName) {
        state.expectingAttributeName = false
        state.expectingAttributeValue = true
      }
      break

    case "TOKEN_EQUALS":
      if (state.inTag) state.expectingAttributeValue = true
      break

    case "TOKEN_QUOTE":
      if (state.inTag) {
        if (!state.inQuotes) {
          state.inQuotes = true
          state.quoteCharacter = text
        } else if (text === state.quoteCharacter) {
          state.inQuotes = false
          state.quoteCharacter = ""
          state.expectingAttributeName = true
          state.expectingAttributeValue = false
        }
      }
      break

    case "TOKEN_WHITESPACE":
      if (state.inTag && !state.inQuotes && state.tagName) {
        state.expectingAttributeName = true
        state.expectingAttributeValue = false
      }
      break

    case "TOKEN_ERB_START":
      state.inERBComment = text.startsWith("<%#")
      state.inERBOutput = text.startsWith("<%=") || text.startsWith("<%-=")
      break

    case "TOKEN_ERB_END":
      state.inERBComment = false
      state.inERBOutput = false
      break

    case "TOKEN_HTML_COMMENT_START":
      state.inComment = true
      break

    case "TOKEN_HTML_COMMENT_END":
      state.inComment = false
      break
  }
}

function categorize(state: ClassifierState, before: ClassifierState, token: Token): TokenCategory {
  if (state.inComment && !COMMENT_DELIMITERS.has(token.type) && !ERB_TOKENS.has(token.type)) {
    return "html.comment"
  }

  if (COMMENT_DELIMITERS.has(token.type)) return "html.comment"
  if (HTML_DELIMITERS.has(token.type)) return "html.delimiter"

  if (ERB_DELIMITERS.has(token.type)) {
    return before.inERBComment || state.inERBComment ? "erb.commentDelimiter" : "erb.delimiter"
  }

  switch (token.type) {
    case "TOKEN_ERB_CONTENT":
      return state.inERBComment ? "erb.comment" : "erb.content"

    case "TOKEN_HTML_DOCTYPE":
      return "html.doctype"

    case "TOKEN_NBSP":
    case "TOKEN_AMPERSAND":
      return "html.entity"

    case "TOKEN_IDENTIFIER":
      if (!before.inTag) break
      if (!before.tagName) return "html.tagName"
      if (before.inQuotes) return "html.attributeValue"
      if (before.expectingAttributeName) return "html.attributeName"
      if (before.expectingAttributeValue) return "html.attributeValue"
      break

    case "TOKEN_QUOTE":
      if (state.inTag) return "html.attributeValue"
      break
  }

  return "other"
}

export function classifyTokens(tokens: Token[], source: string): ClassifiedToken[] {
  const state = initialState()

  return tokens.map(token => {
    const text = source.slice(token.range.start, token.range.end)
    const before = { ...state }

    advance(state, token, text)

    const category = categorize(state, before, token)

    if (category === "html.attributeValue") {
      return { token, category, quoted: state.inQuotes || token.type === "TOKEN_QUOTE" }
    }

    if (category === "erb.delimiter") {
      return { token, category, output: before.inERBOutput || state.inERBOutput }
    }

    return { token, category }
  })
}

const RUBY_HIGHLIGHTED_WORDS = new Set([...RUBY_KEYWORDS, "raise"])
const WORD_SPLIT = /(\s+|[^\w\s]+)/

export interface RubyFragment {
  offset: number
  length: number
  text: string
  keyword: boolean
}

export function splitRubyContent(content: string): RubyFragment[] {
  const fragments: RubyFragment[] = []

  let offset = 0

  for (const text of content.split(WORD_SPLIT)) {
    if (text.length > 0) {
      fragments.push({ offset, length: text.length, text, keyword: RUBY_HIGHLIGHTED_WORDS.has(text) })
    }

    offset += text.length
  }

  return fragments
}
