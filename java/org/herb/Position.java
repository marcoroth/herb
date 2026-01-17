package org.herb;

public class Position {
  private final int line;
  private final int column;

  public Position(int line, int column) {
    this.line = line;
    this.column = column;
  }

  public int getLine() {
    return line;
  }

  public int getColumn() {
    return column;
  }

  @Override
  public String toString() {
    return inspect();
  }

  public String inspect() {
    return String.format("(%d:%d)", line, column);
  }

  public String treeInspect() {
    return inspect();
  }

  @Override
  public boolean equals(Object obj) {
    if (this == obj) return true;
    if (!(obj instanceof Position)) return false;
    Position other = (Position) obj;
    return line == other.line && column == other.column;
  }

  @Override
  public int hashCode() {
    return 31 * line + column;
  }
}
