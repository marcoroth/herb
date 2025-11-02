package org.herb;

import java.util.Collections;
import java.util.List;

public class LexResult {
  private final List<Token> tokens;
  private final String source;

  public LexResult(List<Token> tokens, String source) {
    this.tokens = Collections.unmodifiableList(tokens);
    this.source = source;
  }

  public List<Token> getTokens() {
    return tokens;
  }

  public String getSource() {
    return source;
  }

  public int getTokenCount() {
    return tokens.size();
  }

  public boolean isEmpty() {
    return tokens.isEmpty();
  }

  @Override
  public String toString() {
    return String.format("LexResult{tokens=%d, source=%d chars}", tokens.size(), source.length());
  }
}
