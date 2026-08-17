import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"

import { isRubyParameterNode } from "@herb-tools/core"
import { extractRubyCommentContent, looksLikeLocalsDeclaration } from "./strict-locals-utils.js"

import type { BaseAutofixContext, Mutable, UnboundLintOffense, LintOffense, LintContext, FullRuleConfig } from "../types.js"
import type {ParseResult, ERBContentNode, ERBStrictLocalsNode, RubyParseError, HerbError } from "@herb-tools/core"

const LOCALS_PREFIX = "locals:"

type StrictLocalsCommentNode = ERBContentNode | ERBStrictLocalsNode

type StrictLocalsFix =
  | { type: "erb-comment-tag" }
  | { type: "plural-locals" }
  | { type: "colon-after-locals" }
  | { type: "space-after-colon" }
  | { type: "wrap-parameters" }
  | { type: "close-parameters" }
  | { type: "remove-extra-commas" }
  | { type: "keyword-argument"; name: string }

interface ERBStrictLocalsCommentSyntaxAutofixContext extends BaseAutofixContext {
  node: Mutable<StrictLocalsCommentNode>
  fix: StrictLocalsFix
}

interface Parameters {
  open: number
  close: number | null
  commas: number[]
}

interface Segment {
  start: number
  end: number
}

function extractERBCommentContent(content: string): string {
  return content.trim()
}

function detectLocalsWithoutColon(content: string): boolean {
  return /^locals?\(/.test(content)
}

function detectSingularLocal(content: string): boolean {
  return content.startsWith("local:")
}

function detectMissingColonBeforeParens(content: string): boolean {
  return /^locals\s+\(/.test(content)
}

function hasError(node: { errors: HerbError[] }, type: string): boolean {
  return node.errors.some((error) => error.type === type)
}

function skipStringLiteral(content: string, index: number): number {
  const quote = content[index]
  let cursor = index + 1

  while (cursor < content.length) {
    if (content[cursor] === "\\") {
      cursor += 2

      continue
    }

    if (content[cursor] === quote) return cursor + 1

    cursor++
  }

  return cursor
}

function scanParameters(content: string, open: number): Parameters {
  const commas: number[] = []

  let depth = 0
  let cursor = open

  while (cursor < content.length) {
    const character = content[cursor]

    if (character === '"' || character === "'") {
      cursor = skipStringLiteral(content, cursor)

      continue
    }

    if (character === "(" || character === "[" || character === "{") {
      depth++
    } else if (character === ")" || character === "]" || character === "}") {
      depth--

      if (depth === 0) return { open, close: cursor, commas }
    } else if (character === "," && depth === 1) {
      commas.push(cursor)
    }

    cursor++
  }

  return { open, close: null, commas }
}

function findParameters(content: string): Parameters | null {
  const open = content.indexOf("(")

  if (open === -1) return null

  return scanParameters(content, open)
}

function segmentsOf(parameters: Parameters): Segment[] {
  if (parameters.close === null) return []

  const boundaries = [parameters.open, ...parameters.commas, parameters.close]

  return boundaries.slice(0, -1).map((boundary, index) => ({
    start: boundary + 1,
    end: boundaries[index + 1],
  }))
}

function isBareIdentifier(text: string): boolean {
  return /^[a-z_][a-zA-Z0-9_]*$/.test(text)
}

function keywordizeParameters(content: string, parameters: Parameters, name?: string): string | null {
  let result = content
  let changed = false

  for (const segment of segmentsOf(parameters).reverse()) {
    const text = content.slice(segment.start, segment.end)

    if (!isBareIdentifier(text.trim())) continue
    if (name !== undefined && text.trim() !== name) continue

    const insertAt = segment.start + text.trimEnd().length

    result = `${result.slice(0, insertAt)}:${result.slice(insertAt)}`
    changed = true

    if (name !== undefined) break
  }

  return changed ? result : null
}

function suggestedParameters(inner: string): string {
  const parameters = `(${inner})`

  return keywordizeParameters(parameters, scanParameters(parameters, 0)) ?? parameters
}

function removeExtraCommas(content: string, parameters: Parameters): string | null {
  if (parameters.close === null) return null

  const ranges: Segment[] = []

  for (const comma of parameters.commas) {
    let before = comma - 1
    let after = comma + 1

    while (before > parameters.open && /\s/.test(content[before])) before--
    while (after < parameters.close && /\s/.test(content[after])) after++

    if (before === parameters.open) {
      ranges.push({ start: comma, end: after })
    } else if (after === parameters.close || content[before] === ",") {
      ranges.push({ start: before + 1, end: comma + 1 })
    }
  }

  if (ranges.length === 0) return null

  let result = content

  for (const range of ranges.reverse()) {
    result = result.slice(0, range.start) + result.slice(range.end)
  }

  return result
}

function applyFix(node: Mutable<StrictLocalsCommentNode>, fix: StrictLocalsFix): boolean {
  if (!node.tag_opening) return false
  if (!node.content) return false

  const content = node.content.value

  switch (fix.type) {
    case "erb-comment-tag": {
      const match = content.match(/^\s*#/)
      if (!match) return false

      node.tag_opening.value = "<%#"
      node.content.value = content.slice(match[0].length)

      return true
    }

    case "plural-locals": {
      if (!content.includes("local:")) return false

      node.content.value = content.replace("local:", "locals:")

      return true
    }

    case "colon-after-locals": {
      if (!/locals?\s*\(/.test(content)) return false

      node.content.value = content.replace(/locals?\s*\(/, "locals: (")

      return true
    }

    case "space-after-colon": {
      if (!/locals:\S/.test(content)) return false

      node.content.value = content.replace(/locals:(?=\S)/, "locals: ")

      return true
    }

    case "wrap-parameters": {
      const index = content.indexOf(LOCALS_PREFIX)
      if (index === -1) return false

      const head = content.slice(0, index + LOCALS_PREFIX.length)
      const rest = content.slice(index + LOCALS_PREFIX.length)
      const trailing = rest.slice(rest.trimEnd().length)

      node.content.value = `${head} ${suggestedParameters(rest.trim())}${trailing}`

      return true
    }

    case "close-parameters": {
      const parameters = findParameters(content)

      if (!parameters || parameters.close !== null) {
        return false
      }

      const head = content.trimEnd()

      node.content.value = `${head})${content.slice(head.length)}`

      return true
    }

    case "remove-extra-commas": {
      const parameters = findParameters(content)
      if (!parameters) return false

      const fixed = removeExtraCommas(content, parameters)
      if (fixed === null) return false

      node.content.value = fixed

      return true
    }

    case "keyword-argument": {
      const parameters = findParameters(content)
      if (!parameters) return false

      const fixed = keywordizeParameters(content, parameters, fix.name)
      if (fixed === null) return false

      node.content.value = fixed

      return true
    }
  }
}

class ERBStrictLocalsCommentSyntaxVisitor extends BaseRuleVisitor<ERBStrictLocalsCommentSyntaxAutofixContext> {
  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    if (hasError(node, "STRICT_LOCALS_DUPLICATE_DECLARATION_ERROR")) {
      this.addOffense(
        "Duplicate strict locals declaration. Rails only uses the first `<%# locals: (...) %>` declaration in a partial.",
        node.location,
      )
    }

    const content = node.content?.value ?? ""
    const afterLocals = content.trim().slice(LOCALS_PREFIX.length)

    if (afterLocals.length > 0 && !/^\s/.test(afterLocals)) {
      this.addOffense(
        "Missing space after `locals:`. Rails Strict Locals require a space after the colon: `<%# locals: (...) %>`.",
        node.location,
        this.contextFor(node, { type: "space-after-colon" }),
      )
    }

    if (hasError(node, "STRICT_LOCALS_MISSING_PARENTHESIS_ERROR")) {
      const parameters = afterLocals.trim()

      this.addOffense(
        parameters.length === 0
          ? "Strict locals declarations always need parentheses. Use `<%# locals: () %>` for a partial without locals."
          : `Strict locals parameters must be wrapped in parentheses. Use \`<%# locals: ${suggestedParameters(parameters)} %>\`.`,
        node.location,
        this.contextFor(node, { type: "wrap-parameters" }),
      )

      return
    }

    if (this.reportSyntaxErrors(node, content)) return

    this.reportArgumentErrors(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    const openingTag = node.tag_opening?.value

    const content = node.content?.value
    if (!content) return

    if (openingTag === "<%" || openingTag === "<%-") {
      const rubyComment = extractRubyCommentContent(content)

      if (rubyComment && looksLikeLocalsDeclaration(rubyComment)) {
        this.addOffense(
          `Use \`<%#\` instead of \`${openingTag} #\` for strict locals comments. Only ERB comment syntax is recognized.`,
          node.location,
          this.contextFor(node, { type: "erb-comment-tag" }),
        )
      }

      return
    }

    if (openingTag !== "<%#") return

    const commentContent = extractERBCommentContent(content)
    const remainder = commentContent.match(/^locals?\b(.*)/s)?.[1]

    if (!remainder || !/[(:)]/.test(remainder)) return

    if (detectSingularLocal(commentContent)) {
      this.addOffense(
        "Use `locals:` (plural), not `local:`.",
        node.location,
        this.contextFor(node, { type: "plural-locals" }),
      )

      return
    }

    if (detectLocalsWithoutColon(commentContent)) {
      this.addOffense(
        "Use `locals:` with a colon, not `locals()`. Correct format: `<%# locals: (...) %>`.",
        node.location,
        this.contextFor(node, { type: "colon-after-locals" }),
      )

      return
    }

    if (detectMissingColonBeforeParens(commentContent)) {
      this.addOffense(
        "Use `locals:` with a colon before the parentheses, not `locals (`.",
        node.location,
        this.contextFor(node, { type: "colon-after-locals" }),
      )

      return
    }
  }

  private reportSyntaxErrors(node: ERBStrictLocalsNode, content: string): boolean {
    const syntaxErrors = node.errors.filter((error): error is RubyParseError => error.type === "RUBY_PARSE_ERROR")
    if (syntaxErrors.length === 0) return false

    const parameters = findParameters(content)

    if (parameters && parameters.close === null) {
      this.addOffense(
        "Unbalanced parentheses in the strict locals declaration. Add the missing closing `)`.",
        node.location,
        this.contextFor(node, { type: "close-parameters" }),
      )

      return true
    }

    if (parameters && removeExtraCommas(content, parameters) !== null) {
      this.addOffense(
        "Remove the extra comma from the strict locals parameters.",
        node.location,
        this.contextFor(node, { type: "remove-extra-commas" }),
      )

      return true
    }

    this.addOffense(
      `Invalid Ruby syntax in the strict locals declaration: ${syntaxErrors[0].error_message}.`,
      node.location,
    )

    return true
  }

  private reportArgumentErrors(node: ERBStrictLocalsNode): void {
    for (const local of node.locals) {
      if (!isRubyParameterNode(local)) continue

      const name = local.name?.value ?? ""

      for (const error of local.errors) {
        if (error.type === "STRICT_LOCALS_POSITIONAL_ARGUMENT_ERROR") {
          this.addOffense(
            `Strict locals only support keyword arguments. Use \`${name}:\` instead of the positional argument \`${name}\`.`,
            local.location,
            this.contextFor(node, { type: "keyword-argument", name }),
          )
        } else if (error.type === "STRICT_LOCALS_SPLAT_ARGUMENT_ERROR") {
          this.addOffense(
            `Strict locals only support keyword arguments. The splat argument \`*${name}\` is not supported. Use \`**${name}\` to accept arbitrary keyword arguments.`,
            local.location,
          )
        } else if (error.type === "STRICT_LOCALS_BLOCK_ARGUMENT_ERROR") {
          this.addOffense(
            `Strict locals only support keyword arguments. The block argument \`&${name}\` is not supported.`,
            local.location,
          )
        }
      }
    }
  }

  private contextFor(node: StrictLocalsCommentNode, fix: StrictLocalsFix): ERBStrictLocalsCommentSyntaxAutofixContext {
    return {
      node: node as Mutable<StrictLocalsCommentNode>,
      nodeType: "AST_ERB_CONTENT_NODE",
      fix,
    }
  }
}

// TODO: Strict locals is an Action View feature, so this rule belongs under the `actionview-` prefix next to the four rules that already validate it. The rename waits on a rule-alias mechanism, since it breaks every `.herb.yml` and `herb:disable` comment naming it.
export class ERBStrictLocalsCommentSyntaxRule extends ParserRule<ERBStrictLocalsCommentSyntaxAutofixContext> {
  static autocorrectable = true
  static autofixRequiresContext = true
  static consumesParserErrors = true
  static ruleName = "erb-strict-locals-comment-syntax"
  static introducedIn = this.version("0.8.8")

  get parserOptions() {
    return {
      strict_locals: true,
    }
  }

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      frameworks: ["actionview"],
    }
  }

  check(
    result: ParseResult,
    context?: Partial<LintContext>,
  ): UnboundLintOffense<ERBStrictLocalsCommentSyntaxAutofixContext>[] {
    const visitor = new ERBStrictLocalsCommentSyntaxVisitor(
      this.ruleName,
      context,
    )

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(
    offense: LintOffense<ERBStrictLocalsCommentSyntaxAutofixContext>,
    result: ParseResult,
  ): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, fix } = offense.autofixContext

    return applyFix(node, fix) ? result : null
  }
}
