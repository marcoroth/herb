package org.herb.ast;

import java.util.Collections;
import java.util.List;

public final class ChildNodeField {
  private final String name;
  private final List<String> kind;
  private final boolean continuation;
  private final Node node;

  public ChildNodeField(String name, List<String> kind, boolean continuation, Node node) {
    this.name = name;
    this.kind = kind != null ? kind : Collections.emptyList();
    this.continuation = continuation;
    this.node = node;
  }

  public String getName() {
    return name;
  }

  public List<String> getKind() {
    return kind;
  }

  public boolean isContinuation() {
    return continuation;
  }

  public Node getNode() {
    return node;
  }
}
