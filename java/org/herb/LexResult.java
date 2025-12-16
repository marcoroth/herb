package org.herb;

import java.util.Collections;
import java.util.List;

public class LexResult {
  public final List<Token> tokens;
  public final String source;

  public LexResult(List<Token> tokens, String source) {
    this.tokens = Collections.unmodifiableList(tokens);
    this.source = source;
  }

  public boolean isEmpty() {
    return tokens.isEmpty();
  }

  @Override
  public String toString() {
    return String.format("LexResult{tokens=%d, source=%d chars}", tokens.size(), source.length());
  }

  public String inspect() {
    StringBuilder builder = new StringBuilder();

    for (Token token : tokens) {
      builder.append(token.inspect()).append("\n");
    }

    return builder.toString();
  }
}
