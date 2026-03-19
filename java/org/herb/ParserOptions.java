package org.herb;

public class ParserOptions {
  private boolean trackWhitespace = false;
  private boolean analyze = true;
  private boolean strict = true;
  private boolean actionViewHelpers = false;
  private boolean renderNodes = false;
  private boolean strictLocals = false;
  private boolean prismNodes = false;
  private boolean prismNodesDeep = false;
  private boolean prismProgram = false;

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

  public ParserOptions renderNodes(boolean value) {
    this.renderNodes = value;
    return this;
  }

  public boolean isRenderNodes() {
    return renderNodes;
  }

  public ParserOptions strictLocals(boolean value) {
    this.strictLocals = value;
    return this;
  }

  public boolean isStrictLocals() {
    return strictLocals;
  }

  public ParserOptions prismNodes(boolean value) {
    this.prismNodes = value;
    return this;
  }

  public boolean isPrismNodes() {
    return prismNodes;
  }

  public ParserOptions prismNodesDeep(boolean value) {
    this.prismNodesDeep = value;
    return this;
  }

  public boolean isPrismNodesDeep() {
    return prismNodesDeep;
  }

  public ParserOptions prismProgram(boolean value) {
    this.prismProgram = value;
    return this;
  }

  public boolean isPrismProgram() {
    return prismProgram;
  }

  public static ParserOptions create() {
    return new ParserOptions();
  }
}
