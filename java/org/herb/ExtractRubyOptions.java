package org.herb;

public class ExtractRubyOptions {
  private boolean semicolons = true;
  private boolean comments = false;
  private boolean preservePositions = true;

  public ExtractRubyOptions() {}

  public ExtractRubyOptions semicolons(boolean value) {
    this.semicolons = value;
    return this;
  }

  public boolean isSemicolons() {
    return semicolons;
  }

  public ExtractRubyOptions comments(boolean value) {
    this.comments = value;
    return this;
  }

  public boolean isComments() {
    return comments;
  }

  public ExtractRubyOptions preservePositions(boolean value) {
    this.preservePositions = value;
    return this;
  }

  public boolean isPreservePositions() {
    return preservePositions;
  }

  public static ExtractRubyOptions create() {
    return new ExtractRubyOptions();
  }
}
