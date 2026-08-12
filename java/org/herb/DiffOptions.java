package org.herb;

public class DiffOptions {
  private boolean trackWhitespaceChanges = false;

  public DiffOptions() {}

  public DiffOptions trackWhitespaceChanges(boolean value) {
    this.trackWhitespaceChanges = value;
    return this;
  }

  public boolean isTrackWhitespaceChanges() {
    return trackWhitespaceChanges;
  }
}
