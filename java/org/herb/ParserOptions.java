package org.herb;

public class ParserOptions {
  private boolean trackWhitespace = false;
  private boolean analyze = true;
  private boolean strict = true;
  private boolean actionViewHelpers = false;

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

  public ParserOptions strict(boolean value) {
    this.strict = value;
    return this;
  }

  public boolean isStrict() {
    return strict;
  }

  public ParserOptions actionViewHelpers(boolean value) {
    this.actionViewHelpers = value;
    return this;
  }

  public boolean isActionViewHelpers() {
    return actionViewHelpers;
  }

  public static ParserOptions create() {
    return new ParserOptions();
  }
}
