package org.herb;

import org.herb.ast.Node;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ParseResult {
  public final Node value;
  private final List<Node> errors;
  public final String source;

  public ParseResult(Node value, List<Node> errors, String source) {
    this.value = value;
    this.errors = Collections.unmodifiableList(errors);
    this.source = source;
  }

  public List<Node> recursiveErrors() {
    List<Node> result = new ArrayList<>();

    result.addAll(errors);

    if (value != null) {
      result.addAll(value.recursiveErrors());
    }

    return result;
  }

  public boolean hasErrors() {
    return !recursiveErrors().isEmpty();
  }

  public int getErrorCount() {
    return recursiveErrors().size();
  }

  public boolean isSuccessful() {
    return errors.isEmpty();
  }

  @Override
  public String toString() {
    return String.format("ParseResult{errors=%d, source=%d chars}", errors.size(), source.length());
  }

  public String inspect() {
    StringBuilder builder = new StringBuilder();

    if (value != null) {
      builder.append(value.inspect());
    }

    if (hasErrors()) {
      builder.append("\n\nErrors:\n");

      for (Node error : recursiveErrors()) {
        builder.append(error.inspect()).append("\n");
      }
    }

    return builder.toString();
  }
}
