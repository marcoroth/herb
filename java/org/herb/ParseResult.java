package org.herb;

import org.herb.ast.Node;
import java.util.Collections;
import java.util.List;

public class ParseResult {
  private final Node value;
  private final List<Node> errors;
  private final String source;

  public ParseResult(Node value, List<Node> errors, String source) {
    this.value = value;
    this.errors = Collections.unmodifiableList(errors);
    this.source = source;
  }

  public Node getValue() {
    return value;
  }

  public List<Node> getErrors() {
    return errors;
  }

  public String getSource() {
    return source;
  }

  public boolean hasErrors() {
    return !errors.isEmpty();
  }

  public int getErrorCount() {
    return errors.size();
  }

  public boolean isSuccess() {
    return errors.isEmpty();
  }

  @Override
  public String toString() {
    return String.format("ParseResult{errors=%d, source=%d chars}", errors.size(), source.length());
  }
}
