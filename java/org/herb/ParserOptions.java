package org.herb;

public class ParserOptions {
  private boolean trackWhitespace = false;

  public ParserOptions() {}

  public ParserOptions trackWhitespace(boolean value) {
    this.trackWhitespace = value;
    return this;
  }

  public boolean isTrackWhitespace() {
    return trackWhitespace;
  }

  public static ParserOptions create() {
    return new ParserOptions();
  }
}
