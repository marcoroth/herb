package org.herb;

public class ParserOptions {
  private boolean trackWhitespace = false;
  private boolean analyze = true;

  public ParserOptions() {}

  public ParserOptions trackWhitespace(boolean value) {
    this.trackWhitespace = value;
    return this;
  }

  public boolean isTrackWhitespace() {
    return trackWhitespace;
  }

  public ParserOptions analyze(boolean value) {
    this.analyze = value;
    return this;
  }

  public boolean isAnalyze() {
    return analyze;
  }

  public static ParserOptions create() {
    return new ParserOptions();
  }
}
