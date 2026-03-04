package org.herb.ast;

import java.io.PrintStream;

/**
 * Visitor that prints the AST hierarchy with indentation.
 * Displays node names with proper tree structure.
 */
public class TreePrintVisitor extends Visitor<Void, Integer> {
  private final PrintStream out;
  private final String indent;

  /**
   * Create a new TreePrintVisitor.
   *
   * @param out the output stream to write to
   */
  public TreePrintVisitor(PrintStream out) {
    this.out = out;
    this.indent = "  ";
  }

  /**
   * Print the tree starting from a root node.
   *
   * @param node the root node to print
   */
  public void printTree(Node node) {
    if (node != null) {
      node.accept(this, 0);
    }
  }

  @Override
  public Void visitNode(Node node, Integer depth) {
    printIndent(depth);

    out.println(node.getType());
    visitChildNodes(node, depth + 1);

    return null;
  }

  private void printIndent(int depth) {
    for (int i = 0; i < depth; i++) {
      out.print(indent);
    }
  }
}
