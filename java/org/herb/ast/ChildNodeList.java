package org.herb.ast;

import java.util.List;
import java.util.Collections;

public final class ChildNodeList {
  private final String name;
  private final List<String> kind;
  private final boolean content;
  private final List<Node> nodes;

  public ChildNodeList(String name, List<String> kind, boolean content, List<Node> nodes) {
    this.name = name;
    this.kind = kind != null ? kind : Collections.emptyList();
    this.content = content;
    this.nodes = nodes != null ? nodes : Collections.emptyList();
  }

  public String getName() {
    return name;
  }

  public List<String> getKind() {
    return kind;
  }

  public boolean isContent() {
    return content;
  }

  public List<Node> getNodes() {
    return nodes;
  }
}
