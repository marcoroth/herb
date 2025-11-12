package org.herb.ast;

import org.herb.Location;
import java.util.List;

/**
 * Base interface for all AST nodes.
 */
public interface Node {
  /**
   * Get the type of this node.
   */
  String getType();

  /**
   * Get the location of this node in the source.
   */
  Location getLocation();

  /**
   * Accept a visitor.
   */
  <R, C> R accept(NodeVisitor<R, C> visitor, C context);

  /**
   * Visit all children of this node with the given visitor.
   */
  <R, C> void visitChildren(NodeVisitor<R, C> visitor, C context);

  /**
   * Return a tree-like string representation of this node with all its fields.
   */
  String inspect();

  /**
   * Get all errors from this node and recursively from all child nodes.
   */
  List<Node> recursiveErrors();
}
