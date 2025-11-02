package org.herb.ast;

import org.herb.Location;

/**
 * Simple wrapper for parser errors returned in ParseResult.
 * This is a lightweight representation that can be cast to specific error types if needed.
 */
public class ErrorNode extends BaseNode {
  private final String errorMessage;

  public ErrorNode(String type, Location location, String errorMessage) {
    super(type, location, null);
    this.errorMessage = errorMessage;
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  @Override
  public String treeInspect() {
    StringBuilder output = new StringBuilder();

    output.append("@ ").append(type).append(" ");
    output.append(location != null ? "(location: " + location.toString() + ")" : "no-location");
    output.append("\n");
    output.append("└── message: \"").append(errorMessage).append("\"\n");

    return output.toString();
  }

  @Override
  public String toString() {
    return String.format("ErrorNode{type='%s', message='%s', location=%s}", type, errorMessage, location);
  }
}
