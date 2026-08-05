package org.herb;

public class DiffOptions {
  private boolean detectWhitespaceChanges = false;

  public DiffOptions() {}

  public DiffOptions detectWhitespaceChanges(boolean value) {
    this.detectWhitespaceChanges = value;
    return this;
  }

  public boolean isDetectWhitespaceChanges() {
    return detectWhitespaceChanges;
  }
}
