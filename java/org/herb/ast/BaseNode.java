package org.herb.ast;

import org.herb.Location;

/**
 * Abstract base class for all AST nodes.
 */
public abstract class BaseNode implements Node {
  protected final String type;
  protected final Location location;
  protected final java.util.List<Node> errors;

  protected BaseNode(String type, Location location, java.util.List<Node> errors) {
    this.type = type;
    this.location = location;
    this.errors = errors != null ? errors : java.util.Collections.emptyList();
  }

  @Override
  public String getType() {
    return type;
  }

  @Override
  public Location getLocation() {
    return location;
  }

  public java.util.List<Node> getErrors() {
    return errors;
  }

  @Override
  public <R, C> R accept(NodeVisitor<R, C> visitor, C context) {
    return visitor.visitNode(this, context);
  }

  @Override
  public <R, C> void visitChildren(NodeVisitor<R, C> visitor, C context) {
    // Base implementation does nothing - subclasses override to visit their children
  }

  /**
   * Helper to format errors for tree inspection.
   */
  protected String inspectErrors(String prefix) {
    if (errors == null || errors.isEmpty()) return "";

    StringBuilder output = new StringBuilder();
    int errorCount = errors.size();
    String countLabel = errorCount == 1 ? "error" : "errors";

    output.append("├── errors: (").append(errorCount).append(" ").append(countLabel).append(")\n");

    for (int i = 0; i < errors.size(); i++) {
      Node error = errors.get(i);
      boolean isLast = i == errors.size() - 1;
      String symbol = isLast ? "└── " : "├── ";
      String nextPrefix = isLast ? "    " : "│   ";

      if (error != null) {
        String tree = error.treeInspect();
        if (tree.endsWith("\n")) {
          tree = tree.substring(0, tree.length() - 1);
        }
        output.append(prefix).append(symbol).append(tree.replaceAll("\n", "\n" + prefix + nextPrefix)).append("\n");

        if (!isLast) {
          output.append(prefix).append(nextPrefix).append("\n");
        }
      }
    }
    output.append(prefix).append("\n");

    return output.toString();
  }

  /**
   * Helper to format an array of nodes for tree inspection.
   */
  protected String inspectArray(java.util.List<Node> array, String prefix) {
    if (array == null) return "∅\n";
    if (array.isEmpty()) return "[]\n";

    StringBuilder output = new StringBuilder();
    output.append(String.format("(%d item%s)\n", array.size(), array.size() == 1 ? "" : "s"));

    for (int i = 0; i < array.size(); i++) {
      Node item = array.get(i);
      boolean isLast = i == array.size() - 1;
      String symbol = isLast ? "└── " : "├── ";
      String nextPrefix = isLast ? "    " : "│   ";

      if (item != null) {
        String tree = item.treeInspect();

        if (tree.endsWith("\n")) {
          tree = tree.substring(0, tree.length() - 1);
        }

        output.append(prefix).append(symbol).append(tree.replaceAll("\n", "\n" + prefix + nextPrefix)).append("\n");

        if (!isLast) {
          output.append(prefix).append(nextPrefix).append("\n");
        }
      } else {
        output.append(prefix).append(symbol).append("null\n");

        if (!isLast) {
          output.append(prefix).append(nextPrefix).append("\n");
        }
      }
    }

    return output.toString();
  }

  /**
   * Helper to format a single node for tree inspection.
   */
  protected String inspectNode(Node node, String prefix) {
    if (node == null) return "∅\n";
    String tree = node.treeInspect();

    if (tree.endsWith("\n")) {
      tree = tree.substring(0, tree.length() - 1);
    }

    String[] lines = tree.split("\n", -1);
    if (lines.length == 0) return "∅\n";

    StringBuilder result = new StringBuilder();

    result.append("└── ").append(lines[0]).append("\n");

    for (int i = 1; i < lines.length; i++) {
      if (lines[i].isEmpty()) {
        result.append(prefix).append("\n");
      } else {
        result.append(prefix).append("    ").append(lines[i]).append("\n");
      }
    }

    return result.toString();
  }

  @Override
  public String toString() {
    return String.format("%s@%s", type, location);
  }
}
