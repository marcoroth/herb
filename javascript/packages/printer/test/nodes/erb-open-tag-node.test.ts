import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBOpenTagNode } from "@herb-tools/core"

import { expectNodeToPrint, location, createToken } from "../helpers/printer-test-helpers.js"

describe("ERBOpenTagNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node with output tag", () => {
    const node = ERBOpenTagNode.from({
      type: "AST_ERB_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", " content_tag :div do "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      children: []
    })

    expectNodeToPrint(node, "<%= content_tag :div do %>")
  })

  test("can print from node with silent tag", () => {
    const node = ERBOpenTagNode.from({
      type: "AST_ERB_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " content_tag :div do "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      children: []
    })

    expectNodeToPrint(node, "<% content_tag :div do %>")
  })

  test("can print from node with content_tag and content argument", () => {
    const node = ERBOpenTagNode.from({
      type: "AST_ERB_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", ' content_tag :div, "Content" '),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      children: []
    })

    expectNodeToPrint(node, '<%= content_tag :div, "Content" %>')
  })

  test("can print from node with tag.div helper", () => {
    const node = ERBOpenTagNode.from({
      type: "AST_ERB_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%="),
      content: createToken("TOKEN_ERB_CONTENT", " tag.div do "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      tag_name: createToken("TOKEN_IDENTIFIER", "div"),
      children: []
    })

    expectNodeToPrint(node, "<%= tag.div do %>")
  })

  test("can print from node with null tokens", () => {
    const node = ERBOpenTagNode.from({
      type: "AST_ERB_OPEN_TAG_NODE",
      location,
      errors: [],
      tag_opening: null,
      content: null,
      tag_closing: null,
      tag_name: null,
      children: []
    })

    expectNodeToPrint(node, "")
  })
})
