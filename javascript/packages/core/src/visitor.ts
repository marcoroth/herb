import { Node } from "./node.js"

/**
 * Represents a visitor that can traverse nodes.
 */
export class Visitor {
  /**
   * Visits a node and performs an action.
   * @param node - The node to visit.
   */
  visit(node: Node) {
    console.log("Node", node) // TODO: implement
  }
}
