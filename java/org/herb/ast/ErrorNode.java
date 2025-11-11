package org.herb.ast;

import org.herb.Location;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Simple wrapper for parser errors returned in ParseResult.
 * This is a lightweight representation that can be cast to specific error types if needed.
 */
public class ErrorNode extends BaseNode {
  public final String errorMessage;

  public ErrorNode(String type, Location location, String errorMessage) {
    super(type, location, null);
    this.errorMessage = errorMessage;
  }

  @Override
  public String inspect() {
    StringBuilder output = new StringBuilder();

    output.append("@ ").append(type).append(" ");
    output.append(location != null ? "(location: " + location.toString() + ")" : "no-location");
    output.append("\n");
    output.append("└── message: \"").append(errorMessage).append("\"\n");

    return output.toString();
  }

  @Override
  public List<Node> recursiveErrors() {
    if (errors != null && !errors.isEmpty()) {
      return new ArrayList<>(errors);
    }

    return Collections.emptyList();
  }

  @Override
  public String toString() {
    return String.format("ErrorNode{type='%s', message='%s', location=%s}", type, errorMessage, location);
  }
}
