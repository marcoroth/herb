import { PrismVisitor } from "@herb-tools/core"

import type * as PrismNodes from "@ruby/prism/src/nodes.js"

export class RubyDependencyCollector extends PrismVisitor {
  readonly instanceVariables = new Set<string>()
  readonly constants = new Set<string>()
  readonly knownLocals = new Set<string>()
  readonly bareCalls = new Set<string>()

  override visitInstanceVariableReadNode(node: PrismNodes.InstanceVariableReadNode): void {
    this.instanceVariables.add(String(node.name))

    this.visitChildNodes(node)
  }

  override visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.knownLocals.add(String(node.name))

    this.visitChildNodes(node)
  }

  override visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    this.bind(node.name, node)
  }

  override visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.bind(node.name, node)
  }

  override visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.bind(node.name, node)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.bind(node.name, node)
  }

  override visitBlockParameterNode(node: PrismNodes.BlockParameterNode): void {
    if (node.name) this.knownLocals.add(String(node.name))

    this.visitChildNodes(node)
  }

  override visitRequiredParameterNode(node: PrismNodes.RequiredParameterNode): void {
    this.knownLocals.add(String(node.name))

    this.visitChildNodes(node)
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    const name = String(node.name)

    if (node.receiver === null) {
      this.bareCalls.add(name)
    } else if (node.receiver.constructor.name === "ConstantReadNode") {
      this.constants.add(`${String((node.receiver as PrismNodes.ConstantReadNode).name)}.${name}`)
    }

    this.visitChildNodes(node)
  }

  private bind(name: unknown, node: PrismNodes.Node): void {
    this.knownLocals.add(String(name))

    this.visitChildNodes(node)
  }
}
