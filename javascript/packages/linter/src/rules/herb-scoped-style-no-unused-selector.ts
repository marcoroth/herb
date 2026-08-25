import postcss from "postcss"
import selectorParser from "postcss-selector-parser"

import { getTagLocalName, hasAttribute, getAttribute, getStaticAttributeName, getStaticAttributeValue, getStaticAttributeValueContent, getStaticBodyText, forEachAttribute, isLiteralNode, isHTMLTextNode } from "@herb-tools/core"

import { Location } from "@herb-tools/core"
import { ElementStackVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { ParseResult, DocumentNode, HTMLElementNode, HTMLAttributeNode, ParserOptions, Position } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

interface ScopedBlock {
  node: HTMLElementNode
  css: string
  base: Position | null
}

interface Dead {
  selector: string
  offset: number | null
  length: number
}

interface AttributeValue {
  name: string
  value: string
  list: boolean
}

interface Compound {
  tag: string | null
  classes: Set<string>
  ids: Set<string>
  attributes: Map<string, Set<string>>
}

interface ElementInfo extends Compound {
  ancestors: Compound[]
}

interface CompoundRequirement {
  tag: string | null
  classes: string[]
  ids: string[]
  attributes: string[]
  values: AttributeValue[]
}

interface Segment {
  requirement: CompoundRequirement
  leftCombinator: string | null
}

class ScopedStyleNoUnusedSelectorVisitor extends ElementStackVisitor {
  private blocks: ScopedBlock[] = []
  private elements: ElementInfo[] = []
  private compounds = new Map<HTMLElementNode, Compound>()

  visitDocumentNode(node: DocumentNode): void {
    this.visitChildNodes(node)
    this.report()
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "style" && hasAttribute(node, "scoped")) {
      const css = this.staticCss(node)

      if (css !== null) {
        this.blocks.push({ node, css, base: node.open_tag?.location?.end ?? null })
      }
    } else {
      const ancestors = this.ancestors.map((ancestor) => this.compoundFor(ancestor))

      this.elements.push({ ...this.compoundFor(node), ancestors })
    }

    super.visitHTMLElementNode(node)
  }

  private staticCss(node: HTMLElementNode): string | null {
    const body = node.body ?? []
    const only = body[0]

    if (body.length !== 1 || !only || (!isLiteralNode(only) && !isHTMLTextNode(only))) {
      return null
    }

    return getStaticBodyText(body)
  }

  private compoundFor(node: HTMLElementNode): Compound {
    const cached = this.compounds.get(node)

    if (cached) return cached

    const classes = new Set<string>()
    const ids = new Set<string>()
    const attributes = new Map<string, Set<string>>()

    const classAttribute = getAttribute(node, "class")
    const classContent = classAttribute ? getStaticAttributeValueContent(classAttribute) : null

    if (classContent) {
      classContent.split(/\s+/).filter(Boolean).forEach((token) => classes.add(token))
    }

    const idValue = getStaticAttributeValue(node, "id")

    if (idValue) {
      ids.add(idValue.trim())
    }

    forEachAttribute(node, (attribute: HTMLAttributeNode) => {
      const name = attribute.name ? getStaticAttributeName(attribute.name) : null

      if (name === null) return

      const values = attributes.get(name) ?? new Set<string>()
      const value = getStaticAttributeValueContent(attribute)

      if (value !== null) values.add(value.trim())

      attributes.set(name, values)
    })

    const compound: Compound = { tag: getTagLocalName(node), classes, ids, attributes }

    this.compounds.set(node, compound)

    return compound
  }

  private report(): void {
    if (this.blocks.length === 0) return

    for (const block of this.blocks) {
      const { dead, wholeBlock } = this.analyzeBlock(block.css)

      if (wholeBlock) {
        this.addOffense(
          "Every rule in this `<style scoped>` block matches no element in this file, so the block never applies. Remove it, or point its selectors at markup the file uses.",
          block.node.location,
          undefined,
          undefined,
          ["unnecessary"],
        )

        continue
      }

      for (const entry of dead) {
        this.addOffense(
          `The \`${entry.selector}\` selector in this \`<style scoped>\` block matches no element in this file, so it never applies. Correct it to a class or id the file uses, or remove it.`,
          this.locate(block, entry),
          undefined,
          undefined,
          ["unnecessary"],
        )
      }
    }
  }

  private locate(block: ScopedBlock, dead: Dead): Location {
    if (block.base === null || dead.offset === null) {
      return block.node.open_tag!.location
    }

    const start = this.position(block.base, block.css, dead.offset)
    const end = this.position(block.base, block.css, dead.offset + dead.length)

    return Location.from(start.line, start.column, end.line, end.column)
  }

  private position(base: Position, css: string, offset: number): { line: number, column: number } {
    const before = css.slice(0, offset)
    const newlines = (before.match(/\n/g) || []).length

    if (newlines === 0) {
      return { line: base.line, column: base.column + offset }
    }

    return { line: base.line + newlines, column: offset - before.lastIndexOf("\n") - 1 }
  }

  private analyzeBlock(css: string): { dead: Dead[], wholeBlock: boolean } {
    let root: postcss.Root

    try {
      root = postcss.parse(css)
    } catch {
      return { dead: [], wholeBlock: false }
    }

    const dead: Dead[] = []
    const seen = new Set<string>()
    let totalRules = 0
    let deadRules = 0

    root.walkRules((rule) => {
      if (this.underKeyframes(rule)) return

      totalRules++

      const ruleStart = rule.source?.start?.offset ?? null
      const ruleEnd = rule.source?.end?.offset ?? null

      let selectorCount = 0
      let deadSelectorCount = 0

      selectorParser((selectors) => {
        const single = selectors.nodes.length === 1

        selectors.each((selector) => {
          selectorCount++

          if (!this.deadSelector(selector)) return

          deadSelectorCount++

          const text = selector.toString().trim()

          if (seen.has(text)) return

          seen.add(text)

          if (single && ruleStart !== null && ruleEnd !== null) {
            dead.push({ selector: text, offset: ruleStart, length: ruleEnd - ruleStart })
            return
          }

          const index = selector.first ? selector.first.sourceIndex : 0
          const offset = ruleStart === null ? null : ruleStart + index

          dead.push({ selector: text, offset, length: text.length })
        })
      }).processSync(rule.selector)

      if (selectorCount > 0 && deadSelectorCount === selectorCount) deadRules++
    })

    const wholeBlock = totalRules > 1 && deadRules === totalRules && !this.hasKeyframes(root)

    return { dead, wholeBlock }
  }

  private hasKeyframes(root: postcss.Root): boolean {
    let found = false

    root.walkAtRules((atRule) => {
      if (/keyframes$/i.test(atRule.name)) found = true
    })

    return found
  }

  private deadSelector(selector: selectorParser.Selector): boolean {
    const segments = this.segmentsOf(selector)

    if (segments === null) return false

    return !this.elements.some((element) => this.matchAt(element, element.ancestors, segments, 0))
  }

  private segmentsOf(selector: selectorParser.Selector): Segment[] | null {
    const groups: { nodes: selectorParser.Node[], leftCombinator: string | null }[] = []
    let current: selectorParser.Node[] = []
    let leftCombinator: string | null = null

    for (const node of selector.nodes) {
      if (node.type === "combinator") {
        groups.push({ nodes: current, leftCombinator })

        const value = node.value.trim()
        const combinator = value === "" ? " " : value

        if (combinator !== " " && combinator !== ">") return null

        current = []
        leftCombinator = combinator

        continue
      }

      current.push(node)
    }

    groups.push({ nodes: current, leftCombinator })

    return groups.reverse().map((group) => ({ requirement: this.requirementOf(group.nodes), leftCombinator: group.leftCombinator }))
  }

  private requirementOf(nodes: selectorParser.Node[]): CompoundRequirement {
    const requirement: CompoundRequirement = { tag: null, classes: [], ids: [], attributes: [], values: [] }

    for (const node of nodes) {
      if (node.type === "tag") {
        requirement.tag = node.value
      } else if (node.type === "class") {
        requirement.classes.push(node.value)
      } else if (node.type === "id") {
        requirement.ids.push(node.value)
      } else if (node.type === "attribute") {
        this.attributeRequirement(node, requirement)
      }
    }

    return requirement
  }

  private attributeRequirement(node: selectorParser.Attribute, requirement: CompoundRequirement): void {
    const value = node.value

    if (value !== undefined && (node.operator === "=" || node.operator === "~=")) {
      requirement.values.push({ name: node.attribute, value, list: node.operator === "~=" })
      return
    }

    requirement.attributes.push(node.attribute)
  }

  private matchAt(compound: Compound, ancestors: Compound[], segments: Segment[], index: number): boolean {
    if (!this.compoundMatches(segments[index].requirement, compound)) return false
    if (index === segments.length - 1) return true

    const combinator = segments[index].leftCombinator

    if (combinator === ">") {
      if (ancestors.length === 0) return false

      return this.matchAt(ancestors[ancestors.length - 1], ancestors.slice(0, -1), segments, index + 1)
    }

    if (combinator === " ") {
      for (let position = ancestors.length - 1; position >= 0; position--) {
        if (this.matchAt(ancestors[position], ancestors.slice(0, position), segments, index + 1)) return true
      }
    }

    return false
  }

  private compoundMatches(requirement: CompoundRequirement, compound: Compound): boolean {
    if (requirement.tag !== null && requirement.tag !== compound.tag) return false
    if (!requirement.classes.every((name) => compound.classes.has(name))) return false
    if (!requirement.ids.every((name) => compound.ids.has(name))) return false
    if (!requirement.attributes.every((name) => compound.attributes.has(name))) return false
    if (!requirement.values.every((value) => this.valueMatches(value, compound))) return false

    return true
  }

  private valueMatches({ name, value, list }: AttributeValue, compound: Compound): boolean {
    const values = compound.attributes.get(name)
    if (!values) return false

    if (list) {
      return [...values].some((seen) => seen.split(/\s+/).includes(value))
    }

    return values.has(value)
  }

  private underKeyframes(rule: postcss.Rule): boolean {
    let parent: postcss.Container | postcss.Document | undefined = rule.parent

    while (parent) {
      if (parent.type === "atrule" && /keyframes$/i.test((parent as postcss.AtRule).name)) {
        return true
      }

      parent = parent.parent
    }

    return false
  }
}

export class HerbScopedStyleNoUnusedSelectorRule extends ParserRule {
  static ruleName = "herb-scoped-style-no-unused-selector"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new ScopedStyleNoUnusedSelectorVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
