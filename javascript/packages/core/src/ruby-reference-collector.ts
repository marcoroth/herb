import { PrismVisitor, PrismNodes } from "./prism/index.js"
import { RUBY_KEYWORDS } from "./ruby-keywords.js"
import { helperExists } from "./action-view-helpers.js"

import type { PrismLocation } from "./prism/index.js"

export interface RubyReference {
  name: string
  startOffset: number
  length: number
}

export class RubyReferenceCollector extends PrismVisitor {
  readonly localReads: RubyReference[] = []
  readonly localBindings: RubyReference[] = []
  readonly instanceVariableReads: RubyReference[] = []
  readonly instanceVariableWrites: RubyReference[] = []
  readonly bareCalls: RubyReference[] = []

  override visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.push(this.localReads, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableTargetNode(node: PrismNodes.LocalVariableTargetNode): void {
    this.push(this.localBindings, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitRequiredParameterNode(node: PrismNodes.RequiredParameterNode): void {
    this.push(this.localBindings, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitOptionalParameterNode(node: PrismNodes.OptionalParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitRequiredKeywordParameterNode(node: PrismNodes.RequiredKeywordParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitOptionalKeywordParameterNode(node: PrismNodes.OptionalKeywordParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitRestParameterNode(node: PrismNodes.RestParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitKeywordRestParameterNode(node: PrismNodes.KeywordRestParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitBlockParameterNode(node: PrismNodes.BlockParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitBlockLocalVariableNode(node: PrismNodes.BlockLocalVariableNode): void {
    this.push(this.localBindings, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableReadNode(node: PrismNodes.InstanceVariableReadNode): void {
    this.push(this.instanceVariableReads, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableWriteNode(node: PrismNodes.InstanceVariableWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableAndWriteNode(node: PrismNodes.InstanceVariableAndWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableOrWriteNode(node: PrismNodes.InstanceVariableOrWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableOperatorWriteNode(node: PrismNodes.InstanceVariableOperatorWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableTargetNode(node: PrismNodes.InstanceVariableTargetNode): void {
    this.push(this.instanceVariableWrites, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    if (node.receiver === null && node.arguments_ === null && node.block === null) {
      this.push(this.bareCalls, node.name, node.messageLoc ?? node.location)
    }

    this.visitChildNodes(node)
  }

  private push(references: RubyReference[], name: string | null, location: PrismLocation | null): void {
    if (!name || !location) return

    references.push({ name, startOffset: location.startOffset, length: location.length })
  }
}

const LOCAL_ASSIGNS = "local_assigns"
const LOCAL_NAME = /^[a-z_][a-zA-Z0-9_]*$/
const ROUTE_HELPER = /_(path|url)$/
const PREDICATE_OR_BANG = /[?!]$/

export function isValidLocalName(name: string): boolean {
  if (!LOCAL_NAME.test(name)) return false
  if (RUBY_KEYWORDS.has(name)) return false

  return name !== LOCAL_ASSIGNS
}

/**
 * Whether a receiver-less, argument-less call is more likely a local than a helper.
 *
 * Inside a template a local passed by the caller and a helper method are the same node: both parse
 * as a `CallNode` with no receiver, because nothing binds the local in the template's own scope.
 * Names that end in `?` or `!`, route helpers, and anything in the helper registry are therefore
 * excluded. An application-defined helper still passes, so this is a heuristic and callers should
 * treat a positive result as a candidate rather than a fact.
 */
export function isProbableLocal(name: string): boolean {
  if (!isValidLocalName(name)) return false
  if (PREDICATE_OR_BANG.test(name)) return false
  if (ROUTE_HELPER.test(name)) return false

  return !helperExists(name)
}
