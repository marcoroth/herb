import { ParserRule, BaseAutofixContext, Mutable } from "../types.js"
import { BaseRuleVisitor, findParent } from "./rule-utils.js"
import { isTagAttributesCall } from "./action-view-utils.js"
import { getTagLocalName, isHTMLOpenTagNode, isERBContentNode, isERBOutputNode, isHTMLAttributeNode, isWhitespaceNode, isHTMLElementNode, Location, ERBContentNode, createSyntheticToken } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, LintOffense, FullRuleConfig } from "../types.js"
import type { ParseResult, HTMLElementNode, HTMLOpenTagNode, ParserOptions, Node } from "@herb-tools/core"

interface UnnecessaryTagAttributesAutofixContext extends BaseAutofixContext {
  node: Mutable<HTMLOpenTagNode>
  tagName: string
  isVoid: boolean
}

function hasOnlyTagAttributesChildren(openTag: HTMLOpenTagNode): boolean {
  const nonWhitespaceChildren = openTag.children.filter(child => !isWhitespaceNode(child))

  if (nonWhitespaceChildren.length === 0) return false
  if (nonWhitespaceChildren.some(isHTMLAttributeNode)) return false

  return nonWhitespaceChildren.every(child => {
    if (!isERBContentNode(child)) return false
    if (!isERBOutputNode(child)) return false
    if (!child.prismNode) return false

    return isTagAttributesCall(child.prismNode)
  })
}

function extractTagAttributesArguments(openTag: HTMLOpenTagNode | Mutable<HTMLOpenTagNode>): string | null {
  const erbNode = (openTag.children as Node[]).find(child => isERBContentNode(child) && isERBOutputNode(child))

  if (!erbNode || !isERBContentNode(erbNode)) return null

  const content = erbNode.content?.value?.trim()

  if (!content) return null

  const match = content.match(/^tag\.attributes\((.+)\)$/)

  if (!match) return null

  return match[1]
}

function createERBOutputNode(content: string): ERBContentNode {
  return new ERBContentNode({
    type: "AST_ERB_CONTENT_NODE",
    location: Location.zero,
    errors: [],
    tag_opening: createSyntheticToken("<%="),
    content: createSyntheticToken(content),
    tag_closing: createSyntheticToken("%>"),
    parsed: false,
    valid: true,
    prism_node: null,
  })
}

function createERBSilentNode(content: string): ERBContentNode {
  return new ERBContentNode({
    type: "AST_ERB_CONTENT_NODE",
    location: Location.zero,
    errors: [],
    tag_opening: createSyntheticToken("<%"),
    content: createSyntheticToken(content),
    tag_closing: createSyntheticToken("%>"),
    parsed: false,
    valid: true,
    prism_node: null,
  })
}

class ActionViewNoUnnecessaryTagAttributesVisitor extends BaseRuleVisitor<UnnecessaryTagAttributesAutofixContext> {
  visitHTMLElementNode(node: HTMLElementNode): void {
    this.checkUnnecessaryTagAttributes(node)
    super.visitHTMLElementNode(node)
  }

  private checkUnnecessaryTagAttributes(node: HTMLElementNode): void {
    if (!isHTMLOpenTagNode(node.open_tag)) return

    const tagName = getTagLocalName(node.open_tag)

    if (!tagName) return
    if (!hasOnlyTagAttributesChildren(node.open_tag)) return

    this.addOffense(
      `Avoid using \`tag.attributes\` to set all attributes on \`<${tagName}>\`. Use \`tag.${tagName}\` or add the attributes directly to the \`<${tagName}>\` tag instead.`,
      node.open_tag.location,
      {
        node: node.open_tag,
        tagName,
        isVoid: node.is_void,
      },
    )
  }
}

export class ActionViewNoUnnecessaryTagAttributesRule extends ParserRule<UnnecessaryTagAttributesAutofixContext> {
  static autocorrectable = true
  static ruleName = "actionview-no-unnecessary-tag-attributes"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<UnnecessaryTagAttributesAutofixContext>[] {
    const visitor = new ActionViewNoUnnecessaryTagAttributesVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<UnnecessaryTagAttributesAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node: openTag, tagName, isVoid } = offense.autofixContext
    const tagAttributesArguments = extractTagAttributesArguments(openTag)

    if (!tagAttributesArguments) return null

    const element = findParent(result.value, openTag as unknown as Node)
    if (!element || !isHTMLElementNode(element)) return null

    const grandparent = findParent(result.value, element) as Mutable<Node> | null
    if (!grandparent) return null

    const parentChildren = (grandparent as any).children ?? (grandparent as any).body
    if (!Array.isArray(parentChildren)) return null

    const elementIndex = parentChildren.indexOf(element)
    if (elementIndex === -1) return null

    const hasBody = element.body && element.body.length > 0

    if (isVoid || !hasBody) {
      const erbNode = createERBOutputNode(` tag.${tagName}(${tagAttributesArguments}) `)
      parentChildren.splice(elementIndex, 1, erbNode)
    } else {
      const erbOpenNode = createERBOutputNode(` tag.${tagName}(${tagAttributesArguments}) do `)
      const erbEndNode = createERBSilentNode(` end `)
      const replacementNodes: Node[] = [erbOpenNode, ...element.body, erbEndNode]

      parentChildren.splice(elementIndex, 1, ...replacementNodes)
    }

    return result
  }
}
