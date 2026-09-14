package org.herb;

import org.herb.ast.Node;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ParseResult {
  private final List<Node> errors;

  public final Node value;
  public final String source;
  public final Integer errorCount;

  public ParseResult(Node value, List<Node> errors, String source) {
    this(value, errors, source, null);
  }

  public ParseResult(Node value, List<Node> errors, String source, Integer errorCount) {
    this.value = value;
    this.errors = Collections.unmodifiableList(errors);
    this.source = source;
    this.errorCount = errorCount;
  }

  public List<Node> recursiveErrors() {
    List<Node> result = new ArrayList<>();

    result.addAll(errors);

    if (errorCount != null && errorCount == 0) {
      return result;
    }

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
      builder.append(value.inspect(source));
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
