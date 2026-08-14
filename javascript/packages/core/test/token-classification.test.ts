import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { classifyTokens } from "../src/token-classification.js"

describe("classifyTokens", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function classify(source: string) {
    const tokens = [...Herb.lex(source).value]

    return classifyTokens(tokens, source)
      .map(({ token, category }) => [source.slice(token.range.start, token.range.end), category])
      .filter(([, category]) => category !== "other")
  }

  it("tells a tag name from an attribute name from a value", () => {
    expect(classify(`<div class="card">`)).toEqual([
      ["<", "html.delimiter"],
      ["div", "html.tagName"],
      ["class", "html.attributeName"],
      ['"', "html.attributeValue"],
      ["card", "html.attributeValue"],
      ['"', "html.attributeValue"],
      [">", "html.delimiter"],
    ])
  })

  it("classifies an unquoted attribute value as a value", () => {
    expect(classify(`<input type=text>`)).toContainEqual(["text", "html.attributeValue"])
  })

  it("names a closing tag", () => {
    expect(classify(`</div>`)).toEqual([
      ["</", "html.delimiter"],
      ["div", "html.tagName"],
      [">", "html.delimiter"],
    ])
  })

  it("keeps ERB delimiters separate from their content", () => {
    expect(classify(`<%= user.name %>`)).toEqual([
      ["<%=", "erb.delimiter"],
      [" user.name ", "erb.content"],
      ["%>", "erb.delimiter"],
    ])
  })

  it("treats a comment's insides as comment", () => {
    expect(classify(`<!-- note -->`).every(([, category]) => category === "html.comment")).toBe(true)
  })

  it("still sees ERB inside a comment", () => {
    expect(classify(`<!-- <%= a %> -->`)).toContainEqual(["<%=", "erb.delimiter"])
  })

  it("handles an ERB tag inside an attribute value", () => {
    const classified = classify(`<div class="a <%= b %>">`)

    expect(classified).toContainEqual(["class", "html.attributeName"])
    expect(classified).toContainEqual(["<%=", "erb.delimiter"])
  })

  it("marks quotes as part of the value even as the state leaves them", () => {
    const quotes = classifyTokens([...Herb.lex(`<div id="a">`).value], `<div id="a">`)
      .filter(({ token }) => token.type === "TOKEN_QUOTE")

    expect(quotes).toHaveLength(2)
    expect(quotes.every(({ category, quoted }) => category === "html.attributeValue" && quoted)).toBe(true)
  })

  it("returns one entry per token", () => {
    const source = `<div class="a">text<%= b %></div>`
    const tokens = [...Herb.lex(source).value]

    expect(classifyTokens(tokens, source)).toHaveLength(tokens.length)
  })
})
