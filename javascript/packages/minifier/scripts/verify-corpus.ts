#!/usr/bin/env -S npx tsx

import { readFile } from "fs/promises"
import { glob } from "tinyglobby"

import { Herb } from "@herb-tools/node-wasm"
import { Minifier } from "../src/index.js"

import {
  getTagName,
  isHTMLElementNode,
  isHTMLTextNode,
  isLiteralNode,
  isHTMLAttributeNode,
  isHTMLCommentNode,
  isERBCommentNode,
  isERBNode,
  isERBOutputNode,
  isInlineElement,
  isWhitespacePreservingElement,
} from "@herb-tools/core"

import type { Node, HTMLElementNode, HTMLAttributeNode } from "@herb-tools/core"

const ERB_PLACEHOLDER = "\u0000erb\u0000"
const BLOCK_SEPARATOR = "\u0000block\u0000"
const VERBATIM_PREFIX = "\u0000verbatim\u0000"

type Element = {
  tag: string
  attributes: string[]
}

type Shape = {
  segments: string[]
  elements: Element[]
  erb: string[]
}

function attributeValue(attribute: HTMLAttributeNode): string {
  const parts: string[] = []

  for (const child of attribute.value?.children ?? []) {
    if (isLiteralNode(child) || isHTMLTextNode(child)) {
      parts.push(child.content)
    } else if (isERBNode(child)) {
      if (!isERBCommentNode(child) || erbSource(child).startsWith("herb:")) parts.push(ERB_PLACEHOLDER)
    }
  }

  return parts.join("")
}

function attributeName(attribute: HTMLAttributeNode): string {
  const parts: string[] = []

  for (const child of attribute.name?.children ?? []) {
    if (isLiteralNode(child) || isHTMLTextNode(child)) {
      parts.push(child.content)
    } else if (isERBNode(child)) {
      if (!isERBCommentNode(child) || erbSource(child).startsWith("herb:")) parts.push(ERB_PLACEHOLDER)
    }
  }

  return parts.join("")
}

function describeAttribute(attribute: HTMLAttributeNode): string {
  const name = attributeName(attribute).toLowerCase()
  const value = attributeValue(attribute)

  if (name === "class") {
    return `${name}=${value.split(/\s+/).filter(Boolean).join(" ")}`
  }

  return `${name}=${value}`
}

function verbatimContent(node: Node, into: string[]): void {
  if (isLiteralNode(node) || isHTMLTextNode(node)) {
    into.push(node.content)
    return
  }

  if (isERBNode(node)) {
    if (isERBOutputNode(node)) into.push(ERB_PLACEHOLDER)
    return
  }

  for (const child of node.compactChildNodes()) {
    verbatimContent(child, into)
  }
}

function collectShape(node: Node, shape: Shape, text: string[]): void {
  if (isHTMLCommentNode(node)) return
  if (isERBCommentNode(node) && !erbSource(node).startsWith("herb:")) return

  if (isHTMLTextNode(node) || isLiteralNode(node)) {
    text.push(node.content)
    return
  }

  if (isERBNode(node)) {
    shape.erb.push(node.constructor.name + ":" + erbSource(node))

    if (isERBOutputNode(node)) text.push(ERB_PLACEHOLDER)
  }

  if (isHTMLElementNode(node)) {
    collectElement(node, shape, text)
    return
  }

  for (const child of node.compactChildNodes()) {
    collectShape(child, shape, text)
  }
}

function erbSource(node: Node): string {
  const record = node as unknown as Record<string, { value?: string } | null | undefined>

  return (record.content?.value ?? "").trim()
}

function collectElement(node: HTMLElementNode, shape: Shape, text: string[]): void {
  const tag = (getTagName(node) ?? "").toLowerCase()
  const attributes: string[] = []

  for (const child of node.open_tag?.children ?? []) {
    if (isHTMLAttributeNode(child)) {
      attributes.push(describeAttribute(child))
    }
  }

  shape.elements.push({ tag, attributes })

  const inline = isInlineElement(tag)

  if (!inline) text.push(BLOCK_SEPARATOR)

  if (isWhitespacePreservingElement(tag)) {
    const parts: string[] = []

    for (const child of node.body) {
      verbatimContent(child, parts)
    }

    text.push(BLOCK_SEPARATOR, VERBATIM_PREFIX + parts.join(""), BLOCK_SEPARATOR)
  } else {
    for (const child of node.body) {
      collectShape(child, shape, text)
    }
  }

  if (!inline) text.push(BLOCK_SEPARATOR)
}

function shapeOf(root: Node): Shape {
  const shape: Shape = { segments: [], elements: [], erb: [] }
  const text: string[] = []

  collectShape(root, shape, text)

  shape.segments = text
    .join("")
    .split(BLOCK_SEPARATOR)
    .map(segment => (segment.startsWith(VERBATIM_PREFIX) ? segment : segment.replace(/\s+/g, " ").trim()))
    .filter(segment => segment !== "")

  return shape
}

function describeElements(elements: Element[]): string {
  return elements.map(element => `${element.tag}[${element.attributes.join("|")}]`).join(" ")
}

function firstDifference(left: string[], right: string[]): string | null {
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) {
      return `#${index}\n    original: ${JSON.stringify(left[index])}\n    minified: ${JSON.stringify(right[index])}`
    }
  }

  return null
}

type Failure = {
  file: string
  check: string
  detail: string
}

async function readBaseline(path: string | undefined): Promise<Record<string, number>> {
  if (!path) return {}

  return JSON.parse(await readFile(path, "utf8")) as Record<string, number>
}

async function main() {
  const args = process.argv.slice(2)
  const baselineArgument = args.find(argument => argument.startsWith("--baseline="))
  const patterns = args.filter(argument => !argument.startsWith("--"))

  if (patterns.length === 0) {
    console.error("usage: verify-corpus.ts [--baseline=<file>] <glob> [glob...]")
    process.exit(1)
  }

  const baseline = await readBaseline(baselineArgument?.slice("--baseline=".length))

  await Herb.load()

  const minifier = new Minifier(Herb)
  await minifier.initialize()

  const files = (await glob(patterns, { absolute: true })).sort()

  const failures: Failure[] = []
  let checked = 0
  let skipped = 0

  for (const file of files) {
    let source: string

    try {
      source = await readFile(file, "utf8")
    } catch {
      skipped++
      continue
    }

    const original = Herb.parse(source, { track_whitespace: true })

    if (original.failed) {
      skipped++
      continue
    }

    let minified: string

    try {
      minified = minifier.minifyString(source)
    } catch (error) {
      failures.push({ file, check: "threw", detail: String(error) })
      continue
    }

    checked++

    const reparsed = Herb.parse(minified, { track_whitespace: true })

    if (reparsed.failed) {
      failures.push({ file, check: "reparse", detail: "the minified output no longer parses" })
      continue
    }

    if (minified.length > source.length) {
      failures.push({ file, check: "size", detail: `${source.length} -> ${minified.length}` })
    }

    const before = shapeOf(original.value)
    const after = shapeOf(reparsed.value)

    const textDifference = firstDifference(before.segments, after.segments)

    if (textDifference || before.segments.length !== after.segments.length) {
      failures.push({ file, check: "text", detail: textDifference ?? "segment count differs" })
      continue
    }

    if (describeElements(before.elements) !== describeElements(after.elements)) {
      const difference = firstDifference(
        before.elements.map(element => `${element.tag}[${element.attributes.join("|")}]`),
        after.elements.map(element => `${element.tag}[${element.attributes.join("|")}]`),
      )

      failures.push({ file, check: "structure", detail: difference ?? "element list differs" })
      continue
    }

    if (before.erb.join("\n") !== after.erb.join("\n")) {
      failures.push({ file, check: "erb", detail: firstDifference(before.erb, after.erb) ?? "erb list differs" })
      continue
    }

    if (minifier.minifyString(minified) !== minified) {
      failures.push({ file, check: "idempotence", detail: "minifying the output changed it again" })
    }
  }

  const byCheck = new Map<string, number>()

  for (const failure of failures) {
    byCheck.set(failure.check, (byCheck.get(failure.check) ?? 0) + 1)
  }

  console.log(`Files:      ${files.length}`)
  console.log(`Checked:    ${checked}`)
  console.log(`Skipped:    ${skipped} (did not parse cleanly)`)
  console.log(`Failed:     ${failures.length}`)

  for (const [check, count] of [...byCheck].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check}: ${count}`)
  }

  const checks = new Set([...Object.keys(baseline), ...byCheck.keys()])
  const regressions: string[] = []

  for (const check of [...checks].sort()) {
    const allowed = baseline[check] ?? 0
    const actual = byCheck.get(check) ?? 0

    if (actual > allowed) regressions.push(`${check}: ${actual} failures, budget is ${allowed}`)
  }

  if (failures.length > 0) {
    console.error("")

    for (const failure of failures.slice(0, 50)) {
      console.error(`${failure.file}\n  ${failure.check}: ${failure.detail}\n`)
    }
  }

  if (regressions.length > 0) {
    console.error("")

    for (const regression of regressions) {
      console.error(`::error::${regression}`)
    }

    process.exit(1)
  }

  console.log("")
  console.log("Every check is within its budget.")
}

main()
